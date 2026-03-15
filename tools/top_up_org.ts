import { PrismaClient } from '../packages/database';

async function main() {
  const prisma = new PrismaClient({});
  try {
    await prisma.organization.updateMany({
      data: {
        credits: 99999999,
      },
    });
    console.log('Organization credits topped up.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();
