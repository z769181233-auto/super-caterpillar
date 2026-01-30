import { PrismaClient } from 'database';
import { WorkerJobBase, EngineInvocationRequest } from '@scu/shared-types';
import { EngineHubClient } from '../engine-hub-client';
import { ApiClient } from '../api-client';
import { readFileUnderLimit, readBufferUnderLimit } from '../../../../packages/shared/fs_safe';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { fileExists, ensureDir } from '../../../../packages/shared/fs_async';
import * as crypto from 'crypto';
import sharp from 'sharp';

// Hard Constraints Constants
const MIN_RESOLUTION = 1024;
const EVIDENCE_DIR_FILE = '.current_evidence_dir';

/**
 * P1 Standard: Resolve SSOT Root
 */
function resolveSsotRoot(): string {
  if (process.env.SSOT_ROOT) return path.resolve(process.env.SSOT_ROOT);
  return path.resolve(__dirname, '../../../../');
}

/**
 * Helper: Resolve Absolute Path from Relative Key
 */
function resolveAbsolutePath(relativeKey: string): string {
  const root = resolveSsotRoot();
  return path.join(root, relativeKey);
}

/**
 * Helper: Get Evidence Dir
 */
async function getEvidenceDir(): Promise<string | null> {
  if (await fileExists(EVIDENCE_DIR_FILE)) {
    // 2.5 CE02 Check (Hard Gate)
    // Use fs_safe
    const evidenceContent = await readFileUnderLimit(EVIDENCE_DIR_FILE, 1024 * 1024); // 1MB limit for path file
    const evidenceDir = evidenceContent.trim();
    return evidenceDir;
  }
  return null;
}

/**
 * Helper: Log Evidence
 */
async function logEvidence(filename: string, content: string) {
  const evdDir = await getEvidenceDir(); // Await the async function
  if (evdDir) {
    await fsp.appendFile(path.join(evdDir, filename), content + '\n');
  }
}

/**
 * 结构化日志
 */
function logStructured(level: 'info' | 'warn' | 'error', data: Record<string, any>): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const msg = JSON.stringify(logEntry);
  if (level === 'error') process.stderr.write(msg + '\n');
  else process.stdout.write(msg + '\n');
}

interface IdentityLockPayload {
  characterId: string;
  forceRebuild?: boolean;
  seed?: number;
}

/**
 * STAGE 5D-1: CE02 Identity Lock Processor (Hard Constraints Edition)
 */
export async function processIdentityLockJob(ctx: {
  prisma: PrismaClient;
  job: WorkerJobBase;
  apiClient: ApiClient;
  workerId?: string;
}): Promise<any> {
  const { prisma, job, apiClient } = ctx;
  const jobId = job.id;
  const traceId = job.traceId || `trace-id-lock-${jobId}`;
  const projectId = job.projectId!;

  if (!projectId) throw new Error(`[IdentityLock] Missing projectId for job ${jobId}`);

  const payload = job.payload as IdentityLockPayload;
  const characterId = payload.characterId;

  if (!characterId) throw new Error(`[IdentityLock] Missing characterId in payload`);

  logStructured('info', {
    action: 'IDENTITY_LOCK_START',
    jobId,
    characterId,
    traceId,
  });

  try {
    // 1. Transactional State Management (Active Single Source)
    let anchor = await prisma.$transaction(async (tx) => {
      // Check for EXISTING processing/ready
      const existingActive = await tx.characterIdentityAnchor.findFirst({
        where: { characterId, isActive: true },
      });

      if (existingActive) {
        if (existingActive.status === 'PROCESSING') {
          // Basic timeout check (e.g. 5 minutes)
          const ageMs = Date.now() - existingActive.updatedAt.getTime();
          if (ageMs < 5 * 60 * 1000) {
            throw new Error(
              `Concurrent processing lock: Anchor ${existingActive.id} is PROCESSING`
            );
          }
          // Timeout -> Deactivate and continue
          await tx.characterIdentityAnchor.update({
            where: { id: existingActive.id },
            data: { isActive: false, status: 'FAILED', lastError: 'Timeout overridden' },
          });
        } else if (existingActive.status === 'READY' && !payload.forceRebuild) {
          // Idempotency return
          return { type: 'EXISTING', data: existingActive };
        } else {
          // READY but forcing rebuild -> Deactivate
          await tx.characterIdentityAnchor.update({
            where: { id: existingActive.id },
            data: { isActive: false },
          });
        }
      }

      // Create NEW Processing Anchor
      const newAnchor = await tx.characterIdentityAnchor.create({
        data: {
          characterId,
          status: 'PROCESSING',
          isActive: true, // Only this one is active now
          traceId,
          provider: 'comfyui_tri_view',
        },
      });
      return { type: 'NEW', data: newAnchor };
    });

    if (anchor.type === 'EXISTING') {
      logStructured('info', { action: 'IDENTITY_LOCK_SKIPPED', anchorId: anchor.data.id });
      return { status: 'SKIPPED', anchorId: anchor.data.id };
    }

    const currentAnchorId = anchor.data.id;
    const seed = payload.seed || Math.floor(Math.random() * 2147483647);

    // Character Prompt (Simple Stub)
    // TODO: Fetch from actual Character model
    const characterPrompt = 'A character concept sheet, simple background, 8k, best quality';
    const ssotRoot = resolveSsotRoot();
    const identityDir = path.join(ssotRoot, 'characters', characterId, 'identity', currentAnchorId);

    if (!(await fileExists(identityDir))) {
      await ensureDir(identityDir);
    }

    const views = ['front', 'side', 'back'];
    const viewAssets: Record<string, string> = {};
    const viewHashes: string[] = [];
    const engineHubClient = new EngineHubClient(apiClient);

    // 2. Generation Loop (3 Views)
    for (const view of views) {
      logStructured('info', {
        action: `GENERATING_VIEW_${view.toUpperCase()}`,
        characterId,
        anchorId: currentAnchorId,
      });

      const engineResult = await engineHubClient.invoke<any, any>({
        engineKey: 'shot_render',
        engineVersion: 'default',
        payload: {
          shotId: `char-${characterId}-${view}`,
          prompt: `${characterPrompt}, ${view} view`,
          seed: seed,
          width: 1024,
          height: 1024,
          templateName: 'ce02_identity_triview.json', // BatchSize=1 template
        },
        metadata: { jobId, projectId, traceId },
      });

      if (!engineResult.success || !engineResult.output) {
        throw new Error(`Failed to generate ${view} view: ${engineResult.error?.message}`);
      }

      // 3. Asset Migration & Validation
      const generatedRelPath = engineResult.output.asset.uri; // e.g. apps/workers/.runtime/assets/xxx.png
      const sourceAbsPath = resolveAbsolutePath(generatedRelPath);

      const targetFilename = `${view}.png`;
      const targetAbsPath = path.join(identityDir, targetFilename);
      const targetRelPath = path.relative(ssotRoot, targetAbsPath); // characters/...

      // Move file to SSOT Location
      await fsp.rename(sourceAbsPath, targetAbsPath);

      // Validate: Sharp
      const metadata = await sharp(targetAbsPath).metadata();
      const isValid =
        (metadata.width || 0) >= MIN_RESOLUTION && (metadata.height || 0) >= MIN_RESOLUTION;

      await logEvidence(
        // Await the async function
        'DECODE_ASSERT.log',
        `${new Date().toISOString()} [VALIDATE] ${targetRelPath} Width=${metadata.width} Format=${metadata.format} PASS=${isValid}`
      );

      if (!isValid) {
        throw new Error(
          `Validation failed for ${view}: Resolution ${metadata.width}x${metadata.height} < ${MIN_RESOLUTION}`
        );
      }

      // Verify target
      // Use buffer safe read (max 50MB for identity image? No, usually small. Set 20MB)
      const buffer = await readBufferUnderLimit(targetAbsPath, 20 * 1024 * 1024);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      viewHashes.push(sha256);
      viewAssets[view] = targetRelPath;

      // Evidence
      logEvidence('IDENTITY_TRIVIEW_SHA256.txt', `${sha256}  ${targetRelPath}`);
    }

    const combinedHash = crypto.createHash('sha256').update(viewHashes.join('')).digest('hex');
    logEvidence(
      'IDENTITY_TRIVIEW_SHA256.txt',
      `${combinedHash}  [AGGREGATE_HASH] anchor=${currentAnchorId}`
    );

    // 4. Update Anchor to READY
    await prisma.characterIdentityAnchor.update({
      where: { id: currentAnchorId },
      data: {
        status: 'READY',
        seed: seed,
        viewKeyFront: viewAssets['front'],
        viewKeySide: viewAssets['side'],
        viewKeyBack: viewAssets['back'],
        viewKeysSha256: combinedHash,
        updatedAt: new Date(),
      },
    });

    logStructured('info', {
      action: 'IDENTITY_LOCK_SUCCESS',
      characterId,
      anchorId: currentAnchorId,
      seed,
    });

    // Dump DB Row evidence
    const dbRow = await prisma.characterIdentityAnchor.findUnique({
      where: { id: currentAnchorId },
    });
    logEvidence('DB_ANCHOR_ROW.sql.out', JSON.stringify(dbRow));

    return { status: 'SUCCESS', anchor: dbRow };
  } catch (error: any) {
    logStructured('error', {
      action: 'IDENTITY_LOCK_FAILED',
      characterId,
      error: error.message,
    });

    // Attempt to mark FAILED if we have a provisional anchor?
    // Since we used Transaction for creation, we don't have the ID easily in catch block unless we scoped it.
    // Ideally we should query for the PROCESSING anchor and fail it.
    try {
      const processing = await prisma.characterIdentityAnchor.findFirst({
        where: { characterId, status: 'PROCESSING', isActive: true },
      });
      if (processing) {
        await prisma.characterIdentityAnchor.update({
          where: { id: processing.id },
          data: { status: 'FAILED', lastError: error.message },
          // We keep it Active=true (but Failed) so we know the latest attempt failed?
          // Hard constraint says: "If READY but... check fail... mark old inactive".
          // Here we are failing the NEW one.
        });
      }
    } catch (e) {
      /* ignore cleanup error */
    }

    throw error;
  }
}
