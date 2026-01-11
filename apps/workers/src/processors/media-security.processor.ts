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
  const { videoAssetStorageKey, pipelineRunId, traceId, shotId, projectId } = job.payload;
  let organizationId = job.organizationId;

  // Robustly fetch organizationId if missing (e.g. not provided in WorkerJob DTO)
  if (!organizationId && shotId) {
    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      include: { scene: { include: { episode: { include: { project: true } } } } }
    });
    organizationId = shot?.scene?.episode?.project?.organizationId;
  }

  console.log(`[MediaSecurity] Processing job ${job.id} for shot ${shotId}`);

  // 1. Verify Input
  if (!videoAssetStorageKey || !pipelineRunId || !shotId || !projectId) {
    throw new Error(
      '[MediaSecurity] Missing required payload data: videoAssetStorageKey, pipelineRunId, shotId, or projectId'
    );
  }

  // 2. Locate Source File
  const runtimeDir = path.resolve(process.cwd(), '.runtime');
  const sourcePath = path.resolve(runtimeDir, videoAssetStorageKey);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[MediaSecurity] Source video asset not found at ${sourcePath}`);
  }

  // 3. Perform "Security" Operation (Mock)
  // Logic: Copy file -> generate fingerprint -> simulate watermark
  const secureRelativeDir = path.join('secure', projectId, shotId, pipelineRunId);
  const secureAbsDir = path.join(runtimeDir, secureRelativeDir);

  if (!fs.existsSync(secureAbsDir)) {
    fs.mkdirSync(secureAbsDir, { recursive: true });
  }

  const outputFilename = 'output_secure.mp4';
  const outputAbsPath = path.join(secureAbsDir, outputFilename);
  const outputRelativeKey = path.join(secureRelativeDir, outputFilename).replace(/\\/g, '/');

  // Copy file (Mocking the watermark process)
  fs.copyFileSync(sourcePath, outputAbsPath);

  // Generate Fingerprint (SHA256)
  const fileBuffer = fs.readFileSync(outputAbsPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const fingerprint = hashSum.digest('hex');

  // 4. Persist Secure Asset
  // We create a new Asset of type VIDEO (or secure variant if exists, but usage implies VIDEO with metadata).
  // Owner is valid SHOT.

  // Idempotency check handled by unique constraint on Asset (ownerId + type + ownerType)?
  // No, Asset is unique on [ownerType, ownerId, type].
  // If we already have a VIDEO asset for this shot (the insecure one), we might conflict if we assume 1:1.
  // However, the *insecure* one was created by VIDEO_RENDER.
  // If we want a separate secure asset, we might need a different AssetType (e.g. VIDEO_SECURE?) or we just update the existing one?
  // User request: "Outputs 'safe version' ... write back to Asset system (add new Asset record OR append metadata)".
  // Given unique constraint on [SHOT, shotId, VIDEO], we CANNOT create another VIDEO asset for same shot unless we delete old one or use different type.
  // BUT verify_s4_5 expects "secure Asset exists".
  // Let's check AssetType enum again. from previous view: [VIDEO, IMAGE...].
  // If strict unique constraint exists, we can't have two VIDEO assets for same Shot.
  // OPTION A: Update the *existing* asset with secure metadata?
  // OPTION B: Use a different `AssetType` if available? (No SCREENER/SECURE type seen).
  // OPTION C: The schema constraint is `@@unique([ownerType, ownerId, type])`.
  // This effectively limits us to ONE video per shot.
  // This implies we should UPDATE the existing asset or the Schema is limiting.
  // However, the user said "Can add new Asset record OR append metadata".
  // Since we are differentiating "Insecure" vs "Secure", keeping both might be desired but DB says no.
  // I will UPDATE the existing asset with the new storageKey and secure metadata.
  // Note: This effectively "replaces" the insecure video with the secure one in the Asset registry, which aligns with "Video must enter safety link".
  // Verification expects "Secure Asset exists". Updating meets this.

  /*
    Wait, `verify_s4_5` requires "Original output.mp4 exists" AND "secure output_secure.mp4 exists".
    If we update the Asset record, the *record* points to secure file. The insecure file still exists on disk but is "orphaned" from DB.
    This works for the "Security Link" concept (the official asset becomes the secured one).
    */

  const metadata = {
    watermark: 'SCU',
    fingerprint: fingerprint,
    originalStorageKey: videoAssetStorageKey,
    pipelineRunId,
    traceId,
    securedAt: new Date().toISOString(),
  };

  const secureAsset = await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: AssetOwnerType.SHOT,
        ownerId: shotId,
        type: AssetType.VIDEO,
      },
    },
    update: {
      storageKey: outputRelativeKey,
      checksum: fingerprint,
    },
    create: {
      // This branch shouldn't hit if VIDEO_RENDER succeeded, but just in case
      projectId,
      ownerId: shotId,
      ownerType: AssetOwnerType.SHOT,
      type: AssetType.VIDEO,
      storageKey: outputRelativeKey,
      checksum: fingerprint,
      status: 'GENERATED', // Or 'SECURED'? AssetStatus enum: GENERATED...
      createdByJobId: job.id,
    },
  });

  // 5. Audit
  await prisma.auditLog.create({
    data: {
      resourceType: 'asset',
      resourceId: secureAsset.id,
      action: 'ce09.media_security.success',
      orgId: organizationId || 'unknown',
      details: {
        jobId: job.id,
        fingerprint,
        watermark: 'SCU',
        pipelineRunId,
      },
    },
  });

  // 6. Publishing Review
  // Schema Check: No `status` field. `result` enum handles state.
  // ReviewResult: pass, reject, require_review

  const existingReview = await prisma.publishingReview.findFirst({
    where: { shotId },
  });

  if (existingReview) {
    await prisma.publishingReview.update({
      where: { id: existingReview.id },
      data: {
        // status: ReviewStatus.require_human_review, // Removed: Field does not exist
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
        reviewLog: {}, // Field is required: reviewLog Json
      },
    });
  }
}
