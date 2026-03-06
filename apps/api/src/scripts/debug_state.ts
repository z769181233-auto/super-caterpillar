import * as dotenv from 'dotenv';
dotenv.config({ path: '../../../../gate.env' }); // Adjust path if running from apps/api/src/scripts

import { PrismaClient } from 'database';
import * as util from 'util';

const prisma = new PrismaClient({});

async function main() {
  process.stdout.write(util.format('Checking Seed Data...') + '\n');
  try {
    const users = await prisma.user.count();
    const orgs = await prisma.organization.count();
    const projects = await prisma.project.count();
    process.stdout.write(
      util.format(`Users: ${users}, Orgs: ${orgs}, Projects: ${projects}`) + '\n'
    );

    process.stdout.write(util.format('Checking Recent Jobs...') + '\n');
    const jobs = await prisma.shotJob.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { engineBinding: true },
    });

    process.stdout.write(util.format(`Found ${jobs.length} recent jobs.`) + '\n');
    for (const job of jobs) {
      process.stdout.write(
        util.format(
          `Job: ${job.id}, Type: ${job.type}, Status: ${job.status}, EngineKey: ${job.engineBinding?.engineKey}, Worker: ${job.workerId}`
        ) + '\n'
      );
    }
  } catch (e) {
    process.stderr.write(util.format('Error checking state:', e) + '\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
