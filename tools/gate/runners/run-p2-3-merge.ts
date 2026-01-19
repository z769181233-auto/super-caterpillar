import { videoMergeSelector } from '../../../packages/engines/video_merge/selector';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient, AssetOwnerType, AssetType } from 'database';

async function main() {
  const args = process.argv.slice(2);
  const videoPaths = args.filter((a) => a.endsWith('.mp4'));
  const jobId =
    args.find((a) => a.startsWith('--jobId='))?.split('=')[1] || `gate-p23-${Date.now()}`;
  const projectId = args.find((a) => a.startsWith('--projectId='))?.split('=')[1];
  const ownerId = args.find((a) => a.startsWith('--ownerId='))?.split('=')[1];
  const persist = args.includes('--persist');

  if (videoPaths.length < 2) {
    console.error('Error: Need at least 2 mp4 paths');
    process.exit(1);
  }

  console.log(`[Runner] Merging ${videoPaths.length} videos: ${videoPaths.join(', ')}`);

  try {
    const result = await videoMergeSelector({
      jobId,
      videoPaths: videoPaths.map((p) => path.resolve(p)),
    });

    console.log('--- RESULT START ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('--- RESULT END ---');

    if (persist && projectId && ownerId) {
      console.log(`[Runner] Persisting asset to DB... projectId=${projectId}`);
      const prisma = new PrismaClient();
      const storageKey = path.relative(process.cwd(), result.asset.uri);

      const asset = await prisma.asset.upsert({
        where: {
          ownerType_ownerId_type: {
            ownerType: AssetOwnerType.SHOT,
            ownerId: ownerId,
            type: AssetType.VIDEO,
          },
        },
        update: {
          storageKey,
          checksum: result.asset.sha256,
          status: 'GENERATED',
          createdByJobId: null, // Force null for gate runs to avoid FK issues
        },
        create: {
          projectId,
          ownerId,
          ownerType: AssetOwnerType.SHOT,
          type: AssetType.VIDEO,
          storageKey,
          checksum: result.asset.sha256,
          status: 'GENERATED',
          createdByJobId: null, // Force null for gate runs to avoid FK issues
        },
      });
      console.log('--- ASSET RECORD START ---');
      console.log(JSON.stringify(asset, null, 2));
      console.log('--- ASSET RECORD END ---');
      await prisma.$disconnect();
    }
  } catch (err: any) {
    console.error(`[Runner] Failed: ${err.message}`);
    process.exit(1);
  }
}

main();
