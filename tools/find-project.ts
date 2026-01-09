// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: 'Full Flow Test 2' },
    include: {
      novelAnalysisJobs: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) {
    console.log("Project 'Full Flow Test 2' not found.");
    return;
  }

  console.log(`Project ID: ${project.id}`);
  console.log(`Jobs: ${JSON.stringify(project.novelAnalysisJobs, null, 2)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
