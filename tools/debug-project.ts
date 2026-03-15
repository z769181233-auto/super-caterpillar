// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient({});
const PROJECT_ID = '99a1bcdb-fe85-4244-9a80-dabae0a3dbe1';

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    include: {
      novelAnalysisJobs: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
      seasons: true,
    },
  });

  console.log(JSON.stringify(project, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
