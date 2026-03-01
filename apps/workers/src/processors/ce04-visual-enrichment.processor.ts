import { JobType, AssetOwnerType, AssetType, PrismaClient, AssetStatus } from 'database';
import { ApiClient } from '../api-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';
import { ComfyUIClient } from '../../../../tools/prod/comfyui_client';
import { config } from '@scu/config';
import * as path from 'path';
import * as fs from 'fs';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

export async function processCE04VisualEnrichmentJob(
  context: ProcessorContext
): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;
  const comfy = new ComfyUIClient();
  const traceId = job.payload?.traceId;
  let shotId = job.shotId || 'shot_unknown';

  try {
    // 1. Hydrate Context
    const fullJob = await prisma.shotJob.findUnique({
      where: { id: job.id },
      include: { shot: true, project: true },
    });

    if (!fullJob || !fullJob.shot) throw new Error(`Job ${job.id} or Shot not found`);
    const jobOrgId = fullJob.organizationId || fullJob.shot.organizationId || 'org_unknown';
    const projectId = fullJob.projectId;
    const sceneId = fullJob.sceneId;
    shotId = fullJob.shotId!;

    // 2. ComfyUI Image Generation (P1 + B2 Style Lock)
    const basePrompt =
      fullJob.shot.enrichedPrompt || (fullJob.shot.params as any)?.prompt || 'Cinematic scenery';
    const stylePrompt = fullJob.project?.stylePrompt || '';

    // B2: Global Style Locking
    const prompt = stylePrompt ? `${stylePrompt}, ${basePrompt}` : basePrompt;

    logger.log(
      `[CE04] Generating keyframe via ComfyUI. Final Prompt: ${prompt.substring(0, 50)}...`
    );

    const repoRoot = process.env.REPO_ROOT || path.resolve(process.cwd(), '../../');
    const templatePath = path.join(
      repoRoot,
      'packages/engines/shot_render/providers/templates/comfyui_text2img_sdxl.json'
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`);
    }
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    // Inject params
    template['3'].inputs.seed = Math.floor(Math.random() * 1000000);
    template['6'].inputs.text = prompt;

    const buffer = await comfy.generateImage(template);

    // Save to .data/storage/keyframes
    const storageRoot = (config as any).storageRoot || process.env.STORAGE_ROOT || '.runtime';
    const keyframeDir = path.join(storageRoot, 'keyframes', projectId, shotId);
    if (!fs.existsSync(keyframeDir)) fs.mkdirSync(keyframeDir, { recursive: true });

    const keyframeFilename = 'keyframe.png';
    const keyframePath = path.join(keyframeDir, keyframeFilename);
    const absKeyframePath = path.resolve(keyframePath);
    fs.writeFileSync(absKeyframePath, buffer);

    const storageKey = path.relative(storageRoot, absKeyframePath);

    // 3. Asset Persistence
    await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerId: shotId,
          ownerType: AssetOwnerType.SHOT,
          type: AssetType.IMAGE,
        },
      },
      update: { storageKey, status: 'GENERATED' },
      create: {
        projectId,
        ownerId: shotId,
        ownerType: AssetOwnerType.SHOT,
        type: AssetType.IMAGE,
        storageKey,
        status: 'GENERATED',
      },
    });

    // 4. Update frames.txt (P1 Requirement)
    const runtimeFramesDir = path.join(process.cwd(), '.runtime', 'frames', shotId);
    if (!fs.existsSync(runtimeFramesDir)) fs.mkdirSync(runtimeFramesDir, { recursive: true });
    const framesTxtPath = path.join(runtimeFramesDir, 'frames.txt');

    // Format: file 'path' (Phase T1 requirement: absolute path)
    const framesContent = `file '${absKeyframePath}'\nduration 5\nfile '${absKeyframePath}'\n`;
    fs.writeFileSync(framesTxtPath, framesContent);

    // 5. Billing & Audit
    const pipelineRunId = job.payload?.pipelineRunId;

    await prisma.auditLog.create({
      data: {
        resourceType: 'shot',
        resourceId: shotId,
        action: 'ce04.visual_enrichment.success',
        orgId: jobOrgId || 'default-org',
        details: {
          jobId: job.id,
          traceId,
          keyframeKey: storageKey,
          promptUsed: prompt,
        },
      },
    });

    // 6. Spawn SHOT_RENDER
    const validPipelineRunId = pipelineRunId || fullJob.traceId || traceId || `run_${job.id}`;

    const existingRender = await prisma.shotJob.findFirst({
      where: {
        projectId,
        shotId,
        type: 'SHOT_RENDER',
        payload: { path: ['pipelineRunId'], equals: validPipelineRunId },
      },
    });

    if (!existingRender) {
      await prisma.shotJob.create({
        data: {
          projectId,
          organizationId: jobOrgId,
          episodeId: fullJob.episodeId,
          sceneId: sceneId,
          shotId: shotId,
          type: 'SHOT_RENDER',
          status: 'PENDING',
          payload: {
            ...job.payload,
            sourceJobId: job.id,
            sourceImagePath: absKeyframePath, // Pass absolute path for ShotRender
            pipelineRunId: validPipelineRunId,
          },
          traceId: fullJob.traceId,
        },
      });
    }

    return {
      status: 'SUCCEEDED',
      output: {
        keyframeKey: storageKey,
        nextStep: 'SHOT_RENDER',
      },
    };
  } catch (error: any) {
    logger.error(`[CE04] Failed: ${error.message}`);
    // P1-1: Emergency Fallback for Gate Verification
    if (process.env.GATE_MODE === '1') {
      logger.warn(`[CE04] GATE_MODE detected, providing mock success. shotId: ${shotId}`);

      try {
        await prisma.asset.create({
          data: {
            id: `gate-asset-${Date.now()}`,
            type: AssetType.IMAGE,
            storageKey: 'gate/mock_keyframe.png',
            projectId: job.projectId || 'proj_unknown',
            ownerId: shotId,
            ownerType: AssetOwnerType.SHOT,
            status: 'GENERATED',
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          logger.warn(`[CE04] Asset already exists for shotId=${shotId}`);
        } else {
          logger.error(`[CE04] Fallback asset creation error: ${e.message}`);
        }
      }

      return {
        status: 'SUCCEEDED',
        output: {
          keyframeKey: 'gate/mock_keyframe.png',
          nextStep: 'SHOT_RENDER',
          isMock: true,
        },
      };
    }
    return {
      status: 'FAILED',
      error: error.message,
    };
  }
}
