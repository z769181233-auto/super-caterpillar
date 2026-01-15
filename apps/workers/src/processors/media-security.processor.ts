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
// import { PRODUCTION_MODE } from '@scu/config';
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

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
    sourceStorageKey = asset.storageKey.replace(/^file:\/\//, '');
    console.log(`[MediaSecurity] Resolved AssetId ${targetAssetId} to storageKey ${sourceStorageKey}`);
  } else if (shotId) {
    if (PRODUCTION_MODE) {
      throw new Error(`PRODUCTION_MODE_FORBIDS_LEGACY_SHOT_ACCESS: Media Security requires explicit assetId in production.`);
    }
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
    sourceStorageKey = asset.storageKey.replace(/^file:\/\//, '');
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

  const outputFilename = `secure_${path.basename(sourceStorageKey, path.extname(sourceStorageKey))}.mp4`;
  const outputAbsPath = path.join(secureAbsDir, outputFilename);
  const outputRelativeKey = path.join(secureRelativeDir, outputFilename).replace(/\\/g, '/');

  const hlsSecureDir = path.join(secureAbsDir, 'hls');
  if (!fs.existsSync(hlsSecureDir)) fs.mkdirSync(hlsSecureDir, { recursive: true });
  const hlsPlaylistFilename = 'master.m3u8';
  const hlsPlaylistAbsPath = path.join(hlsSecureDir, hlsPlaylistFilename);
  const hlsPlaylistRelativeKey = path.join(secureRelativeDir, 'hls', hlsPlaylistFilename).replace(/\\/g, '/');

  // 4. Real Security Operation: Watermark + HLS Packaging
  console.log(`[MediaSecurity] Applying visible watermark and packaging HLS for ${sourceStorageKey}`);

  // FFmpeg: Visible Watermark + MP4 Output
  const watermarkText = 'SUPER_CATERPILLAR_UNIVERSE';
  const secureMp4Args = [
    '-i', sourcePath,
    '-vf', `drawtext=text='${watermarkText}':x=10:y=H-th-10:fontsize=24:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`,
    '-codec:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-codec:a', 'copy',
    '-y', outputAbsPath
  ];

  await runFfmpeg(secureMp4Args, 'CE09_Watermark_MP4');

  // FFmpeg: HLS Packaging from Secure MP4
  const hlsArgs = [
    '-i', outputAbsPath,
    '-c', 'copy',
    '-start_number', '0',
    '-hls_time', '10',
    '-hls_list_size', '0',
    '-f', 'hls',
    hlsPlaylistAbsPath
  ];
  await runFfmpeg(hlsArgs, 'CE09_HLS_Secure');

  // Generate Fingerprint (SHA256) of the SECURE MP4
  const fileBuffer = fs.readFileSync(outputAbsPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const fingerprint = hashSum.digest('hex');

  // 5. Update Asset (Security Link - Dedicated Columns DBSpec V1.1)
  // Fix: Create SecurityFingerprint record first to satisfy FK constraint
  let fpRecord = await prisma.securityFingerprint.findFirst({
    where: { assetId: targetAssetId }
  });

  if (!fpRecord) {
    fpRecord = await prisma.securityFingerprint.create({
      data: {
        assetId: targetAssetId,
        fpVector: { algorithm: 'sha256', hash: fingerprint }
      }
    });
  }

  await prisma.asset.update({
    where: { id: targetAssetId },
    data: {
      storageKey: outputRelativeKey,
      checksum: fingerprint,
      status: 'PUBLISHED',
      // V1.1 Security Fields (Real Values)
      hlsPlaylistUrl: hlsPlaylistRelativeKey,
      signedUrl: `/api/assets/signed-url?key=${outputRelativeKey}&t=${Date.now()}`,
      watermarkMode: 'SCU_VISIBLE_V1_BOTTOM_LEFT',
      fingerprintId: fpRecord.id,
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

async function runFfmpeg(args: string[], label: string) {
  console.log(`[FFmpeg ${label}] Executing: ffmpeg ${args.join(' ')}`);
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args);
    let output = '';
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `[FFmpeg ${label}] Exited with code ${code}. Output: ${output.substring(output.length - 500)}`
          )
        );
    });
  });
}
