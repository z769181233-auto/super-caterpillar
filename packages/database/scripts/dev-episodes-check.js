const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.episode.count();
  const nulls = await prisma.episode.count({ where: { seasonId: null } });
  const grouped = await prisma.episode.groupBy({
    by: ['projectId'],
    _count: { _all: true },
    where: { seasonId: null },
  });
  console.log(JSON.stringify({ total, nulls, grouped }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
