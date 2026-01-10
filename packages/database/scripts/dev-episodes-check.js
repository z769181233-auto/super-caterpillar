import * as util from "util";

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
  process.stdout.write(util.format(JSON.stringify({ total, nulls, grouped }, null, 2)) + "\n");
}

main()
  .catch((err) => {
    process.stderr.write(util.format(err) + "\n");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
