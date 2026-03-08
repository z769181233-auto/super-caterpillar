// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient({});

async function main() {
  const keys = await prisma.apiKey.findMany();
  console.log('API Keys in DB:', JSON.stringify(keys, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
