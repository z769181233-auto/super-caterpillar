import { PrismaClient } from '../packages/database';

async function main() {
  const prisma = new PrismaClient({});
  try {
    await prisma.costCenter.updateMany({
      data: {
        budget: 99999999,
        currentCost: 0,
      },
    });
    console.log('Budgets reset and cost cleared.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();
