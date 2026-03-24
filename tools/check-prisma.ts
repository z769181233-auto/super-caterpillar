import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({});
  console.log('Checking keys on prisma client...');
  const keys = Object.keys(prisma);
  console.log('Keys:', keys);

  if ((prisma as any).semanticEnhancement) {
    console.log('✅ semanticEnhancement model exists!');
  } else {
    console.error('❌ semanticEnhancement model MISSING!');
  }
}

main();
