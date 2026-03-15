import * as util from 'util';

function log(msg: string) {
  process.stdout.write(util.format(msg) + '\n');
}

async function main() {
  const jobIds = process.argv.slice(2).filter(Boolean);
  if (jobIds.length === 0) {
    throw new Error('Usage: tsx tools/gate/scripts/process_context_jobs.ts <jobId> [jobId...]');
  }

  // Avoid recursively starting the internal interval worker inside this helper.
  process.env.ENABLE_INTERNAL_JOB_WORKER = 'false';
  process.env.JOB_WORKER_ENABLED = 'false';
  process.env.NODE_ENV = process.env.NODE_ENV || 'staging';
  process.env.ENGINE_DEFAULT = process.env.ENGINE_DEFAULT || 'ce06_novel_parsing';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'gate-ci-jwt-secret';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'gate-ci-jwt-refresh-secret';

  const [{ NestFactory }, { AppModule }, { JobService }, { PrismaService }] = await Promise.all([
    import('@nestjs/core'),
    import('../../../apps/api/src/app.module'),
    import('../../../apps/api/src/job/job.service'),
    import('../../../apps/api/src/prisma/prisma.service'),
  ]);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const jobService = app.get(JobService);
    const prisma = app.get(PrismaService);

    for (const jobId of jobIds) {
      log(`[GATE_DRIVER] processing job ${jobId}`);
      await jobService.processJob(jobId);

      const job = await prisma.shotJob.findUnique({
        where: { id: jobId },
        select: { id: true, status: true, lastError: true },
      });

      if (!job) {
        throw new Error(`Job not found after processing: ${jobId}`);
      }

      log(
        `[GATE_DRIVER] job=${job.id} status=${job.status} lastError=${job.lastError ?? '<none>'}`
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exit(1);
});
