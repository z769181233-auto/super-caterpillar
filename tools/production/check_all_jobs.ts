import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.shotJob.findMany({
    where: {
      projectId: 'scale_bench_1769795112593_0',
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
    },
  });

  console.log(`Found ${jobs.length} jobs for project scale_bench_1769795112593_0:`);
  jobs.forEach((j) =>
    console.log(`[${j.createdAt.toISOString()}] ${j.type} | ${j.status} | ${j.id}`)
  );

  await prisma.$disconnect();
}

main().catch(console.error);
