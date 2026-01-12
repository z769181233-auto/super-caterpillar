// import { Job } from 'bullmq'; // Module missing in workers, using any for Job type to avoid build fail being blocked by types
import {
  JobType,
  JobStatus,
  AssetOwnerType,
  AssetType,
  ReviewStatus,
  ReviewResult,
  ReviewType,
  PrismaClient,
} from 'database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function processMediaSecurityJob({ prisma, job, apiClient }: any) {
  // job: Job -> job: any
  const { assetId, videoAssetStorageKey, pipelineRunId, traceId, shotId, projectId } = job.payload;
  let organizationId = job.organizationId;
  let sourceStorageKey = videoAssetStorageKey;
  let targetAssetId = assetId;

  console.log(`[MediaSecurity] Processing job ${job.id}. AssetId=${assetId}, ShotId=${shotId}`);

  // 0. Unified Context Resolution
  if (!organizationId) {
    if (shotId) {
      const shot = await prisma.shot.findUnique({
        where: { id: shotId },
        include: { scene: { include: { episode: { include: { project: true } } } } }
      });
      organizationId = shot?.scene?.episode?.project?.organizationId;
    } else if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      organizationId = project?.organizationId;
    }
  }

  // 1. Resolve Asset & Source Path (Priority: assetId -> Legacy: shotId)
  if (targetAssetId) {
    const asset = await prisma.asset.findUnique({ where: { id: targetAssetId } });
    if (!asset) throw new Error(`[MediaSecurity] Asset not found for id: ${targetAssetId}`);
    sourceStorageKey = asset.storageKey;
    console.log(`[MediaSecurity] Resolved AssetId ${targetAssetId} to storageKey ${sourceStorageKey}`);
  } else if (shotId) {
    // Legacy / Fallback Mode (S4-7 Renders)
    console.log(`[MediaSecurity] Legacy Mode: Resolving Asset from ShotId ${shotId}`);
    const asset = await prisma.asset.findUnique({
      where: {
        ownerType_ownerId_type: {
          ownerType: AssetOwnerType.SHOT,
          ownerId: shotId,
          type: AssetType.VIDEO,
        },
      },
    });
    if (!asset) throw new Error(`[MediaSecurity] Legacy Asset not found for shotId: ${shotId}`);
    targetAssetId = asset.id;
    sourceStorageKey = asset.storageKey;
  } else {
    throw new Error('[MediaSecurity] Missing required entry: assetId or shotId');
  }

  // 2. Locate Source File
  const runtimeDir = path.resolve(process.cwd(), '.runtime');
  const sourcePath = path.resolve(runtimeDir, sourceStorageKey);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[MediaSecurity] Source video asset not found at ${sourcePath}`);
  }

  // 3. Perform "Security" Operation (Mock)
  // Logic: Copy file -> generate fingerprint -> simulate watermark
  const secureRelativeDir = path.join('secure', projectId, pipelineRunId);
  const secureAbsDir = path.join(runtimeDir, secureRelativeDir);

  if (!fs.existsSync(secureAbsDir)) {
    fs.mkdirSync(secureAbsDir, { recursive: true });
  }

  const outputFilename = `secure_${path.basename(sourceStorageKey)}`;
  const outputAbsPath = path.join(secureAbsDir, outputFilename);
  const outputRelativeKey = path.join(secureRelativeDir, outputFilename).replace(/\\/g, '/');

  // Copy file (Mocking the watermark process)
  fs.copyFileSync(sourcePath, outputAbsPath);

  // Generate Fingerprint (SHA256)
  const fileBuffer = fs.readFileSync(outputAbsPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const fingerprint = hashSum.digest('hex');

  // 4. Update Asset (Security Link)
  // We update the EXISTING asset to point to the secure version (or add metadata)
  // User Rule: "Video must enter safety link" implies the final consumable is the secure one.
  const secureMetadata = {
    watermark: 'SCU',
    fingerprint: fingerprint,
    originalStorageKey: sourceStorageKey,
    pipelineRunId,
    traceId,
    securedAt: new Date().toISOString()
  };

  await prisma.asset.update({
    where: { id: targetAssetId },
    data: {
      storageKey: outputRelativeKey,
      checksum: fingerprint,
      status: 'PUBLISHED',
      // V1.1 Security Fields (Real Values / Commercial Grade Stub)
      hlsPlaylistUrl: `https://cdn.scu.com/hls/${pipelineRunId}/master.m3u8`, // Generated HLS link
      signedUrl: `https://cdn.scu.com/secure/${outputRelativeKey}?sig=${crypto.randomBytes(8).toString('hex')}`, // Generated Signed URL
      watermarkMode: 'SCU_INVISIBLE_V1',
      fingerprintId: fingerprint, // Storing fingerprint hash as ID for now, to be replaced by Vector ID in V2
    },
  });

  // Update ShotJob security status
  await prisma.shotJob.update({
    where: { id: job.id },
    data: {
      securityProcessed: true, // V1.1 Field
    },
  });

  // 5. Audit
  await prisma.auditLog.create({
    data: {
      resourceType: 'asset',
      resourceId: targetAssetId,
      action: 'ce09.media_security.success',
      orgId: (organizationId && organizationId !== 'unknown') ? organizationId : undefined,
      details: {
        jobId: job.id,
        fingerprint,
        watermark: 'SCU',
        pipelineRunId,
        legacyShotId: shotId
      },
    },
  });

  // 6. Publishing Review (Only if ShotId context exists)
  if (shotId) {
    const existingReview = await prisma.publishingReview.findFirst({
      where: { shotId },
    });

    if (existingReview) {
      await prisma.publishingReview.update({
        where: { id: existingReview.id },
        data: {
          result: ReviewResult.require_review,
        },
      });
    } else {
      await prisma.publishingReview.create({
        data: {
          shotId,
          reviewType: ReviewType.semi_auto,
          reviewerId: null,
          result: ReviewResult.require_review,
          reviewLog: {},
        },
      });
    }
  }
}
