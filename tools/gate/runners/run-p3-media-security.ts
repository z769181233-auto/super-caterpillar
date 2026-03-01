import { processMediaSecurityJob } from '../../../apps/workers/src/processors/media-security.processor';
import { PrismaClient } from 'database';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const assetId = args.find((a) => a.startsWith('--assetId='))?.split('=')[1];
  const projectId =
    args.find((a) => a.startsWith('--projectId='))?.split('=')[1] || 'proj_p3_1_gate';
  const jobId =
    args.find((a) => a.startsWith('--jobId='))?.split('=')[1] || `gate-security-${Date.now()}`;

  if (!assetId) {
    console.error('Error: --assetId is required');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const job = {
      id: jobId,
      organizationId: 'org-gate',
      payload: {
        assetId,
        projectId,
        pipelineRunId: `run-${Date.now()}`,
      },
    };

    console.log(`[Runner] Starting Media Security for Asset: ${assetId}`);

    // We need to mock the context
    await processMediaSecurityJob({
      prisma,
      job,
      apiClient: {} as any,
    } as any);

    console.log('--- SECURITY SUCCESS ---');
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    console.log('--- ASSET RECORD START ---');
    console.log(JSON.stringify(asset, null, 2));
    console.log('--- ASSET RECORD END ---');
  } catch (err: any) {
    console.error(`[Runner] Failed: ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
