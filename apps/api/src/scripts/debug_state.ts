import * as dotenv from 'dotenv';
dotenv.config({ path: '../../../../gate.env' }); // Adjust path if running from apps/api/src/scripts

import { PrismaClient } from 'database';
const prisma = new PrismaClient();

async function main() {
  console.log('Checking Seed Data...');
  try {
    const users = await prisma.user.count();
    const orgs = await prisma.organization.count();
    const projects = await prisma.project.count();
    console.log(`Users: ${users}, Orgs: ${orgs}, Projects: ${projects}`);

    console.log('Checking Recent Jobs...');
    const jobs = await prisma.shotJob.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { engineBinding: true },
    });

    console.log(`Found ${jobs.length} recent jobs.`);
    for (const job of jobs) {
      console.log(
        `Job: ${job.id}, Type: ${job.type}, Status: ${job.status}, EngineKey: ${job.engineBinding?.engineKey}, Worker: ${job.workerId}`
      );
    }
  } catch (e) {
    console.error('Error checking state:', e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
