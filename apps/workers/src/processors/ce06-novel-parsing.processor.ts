import { JobType } from 'database';
import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { ce06RealEngine } from '../../../../packages/engines/ce06/real';
import { createHash } from 'crypto';
import { CostLedgerService } from '../billing/cost-ledger.service';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

interface CE06Context {
  prisma: PrismaClient;
  job: any; // Using any for now to avoid compilation errors with WorkerJob
  apiClient: ApiClient;
  logger?: any;
}

/**
 * CE06 Novel Parsing Processor (Real AI Implementation)
 * Aligned with ce06_core_blueprint.md V1.1
 */
export async function processCE06NovelParsingJob(context: CE06Context): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  try {
    // 1. Context Hydration
    const fullJob = await prisma.shotJob.findUnique({
      where: { id: job.id },
    });

    if (!fullJob) throw new Error(`Job ${job.id} not found`);

    const payload = job.payload || {};
    const rawText = payload.raw_text || payload.sourceText;
    const projectId = fullJob.projectId;
    const organizationId = fullJob.organizationId;
    const userId = (fullJob as any).userId || 'system';

    if (!rawText || !projectId || !organizationId) {
      throw new Error('Missing required job parameters (raw_text, projectId, or organizationId)');
    }

    // 2. Real AI Parsing (Gemini 2.0 Flash)
    logger.log(`[CE06] Invoking Gemini for project ${projectId}...`);
    const engineResult = await ce06RealEngine({
      structured_text: rawText,
      traceId: payload.traceId || job.id,
    });

    if (!engineResult.audit_trail) {
      throw new Error('Engine result missing audit_trail');
    }

    // 3. DB Upsert Logic (Aligned with DBSpec V1.1)
    const textHash = createHash('sha256').update(rawText).digest('hex');
    const parserVer = engineResult.audit_trail.engine_version;
    const idempotencyKey = createHash('sha256').update(`${projectId}${textHash}${parserVer}`).digest('hex');

    logger.log(`[CE06] Parsing successful. Saving to DB (Idempotency: ${idempotencyKey.slice(0, 8)})...`);

    await prisma.$transaction(async (tx) => {
      // Save Parse Result summary
      await tx.novelParseResult.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          projectId,
          organizationId,
          status: 'COMPLETED',
          parsingQuality: engineResult.parsing_quality || 1.0,
          rawOutput: engineResult.volumes as any,
          modelVersion: parserVer,
        },
        update: {
          status: 'COMPLETED',
          parsingQuality: engineResult.parsing_quality || 1.0,
          rawOutput: engineResult.volumes as any,
          updatedAt: new Date(),
        },
      });

      // NovelSource is assumed to exist from previous steps or handled here if needed
      // For now, we look for an existing NovelSource to bind to
      const novelSource = await tx.novelSource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      if (!novelSource) {
        throw new Error(`NovelSource for project ${projectId} not found. Cannot bind volumes/chapters.`);
      }

      // Iterate and Upsert Volume/Chapter/Scene
      for (const vol of engineResult.volumes) {
        const volume = await tx.novelVolume.upsert({
          where: {
            projectId_index: { projectId, index: vol.index || 1 },
          },
          create: {
            projectId,
            novelSourceId: novelSource.id,
            index: vol.index || 1,
            title: vol.title || 'Untitled Volume',
          },
          update: {
            title: vol.title || 'Untitled Volume',
          },
        });

        for (const chap of (vol.chapters || [])) {
          const chapter = await tx.novelChapter.upsert({
            where: {
              volumeId_index: { volumeId: volume.id, index: chap.index || 1 },
            },
            create: {
              volumeId: volume.id,
              novelSourceId: novelSource.id,
              index: chap.index || 1,
              title: chap.title || 'Untitled Chapter',
              summary: chap.summary || '',
              isSystemControlled: true,
            },
            update: {
              title: chap.title || 'Untitled Chapter',
              // Protection strategy: if manual override exists (not system controlled), don't overwrite summary
              // For simplicity in MVP, we overwrite if system controlled
              summary: chap.summary || '',
            },
          });

          for (const sc of (chap.scenes || [])) {
            await tx.novelScene.upsert({
              where: {
                chapterId_index: { chapterId: chapter.id, index: sc.index || 1 },
              },
              create: {
                chapterId: chapter.id,
                index: sc.index || 1,
                title: sc.title || 'Untitled Scene',
                rawText: sc.content || '',
                directingNotes: sc.directing_notes || '',
                shotType: sc.shot_type || 'MEDIUM_SHOT',
              },
              update: {
                title: sc.title || 'Untitled Scene',
                rawText: sc.content || '',
                directingNotes: sc.directing_notes || '',
                shotType: sc.shot_type || 'MEDIUM_SHOT',
              },
            });
          }
        }
      }
    });

    // 4. Billing (CostLedger Integration)
    const costService = new CostLedgerService(apiClient);
    await costService.recordCE06Billing({
      jobId: job.id,
      jobType: JobType.CE06_NOVEL_PARSING,
      traceId: payload.traceId || job.id,
      projectId,
      userId,
      orgId: organizationId,
      attempt: fullJob.attempts || 1,
      billingUsage: engineResult.billing_usage,
    });

    // 5. Audit Log
    await prisma.auditLog.create({
      data: {
        resourceType: 'project',
        resourceId: projectId,
        action: 'ce06.novel_parsing.success',
        orgId: organizationId,
        userId: userId,
        details: {
          jobId: job.id,
          traceId: payload.traceId,
          audit_trail: engineResult.audit_trail,
          billing: engineResult.billing_usage,
        } as any,
      },
    });

    return {
      status: 'SUCCEEDED',
      output: {
        parsing_quality: engineResult.parsing_quality,
        idempotencyKey,
      },
    };
  } catch (error: any) {
    logger.error(`[CE06] Failed: ${error.message}`);
    return {
      status: 'FAILED',
      error: error.message,
    };
  }
}
