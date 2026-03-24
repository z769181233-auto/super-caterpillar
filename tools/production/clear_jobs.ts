import * as dotenv from 'dotenv';
import * as path from 'path';
// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

async function main() {
  console.log('Clearing PENDING jobs...');
  try {
    const deleted = await prisma.shotJob.deleteMany({
      where: { status: 'PENDING' },
    });
    console.log(`Deleted ${deleted.count} PENDING jobs.`);
  } catch (e) {
    console.error('Error clearing jobs:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
