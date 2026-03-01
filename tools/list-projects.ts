// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log(
    'Recent Projects:',
    projects.map((p) => ({ id: p.id, name: p.name, created: p.createdAt }))
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
