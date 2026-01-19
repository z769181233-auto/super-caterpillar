import { PrismaClient } from 'database';

async function check() {
  const prisma = new PrismaClient();
  try {
    const key = await prisma.apiKey.findUnique({
      where: { key: 'local-worker' },
    });
    console.log('Result:', key);
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
