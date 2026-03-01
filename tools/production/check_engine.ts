import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function check() {
  console.log('PRODUCTION_MODE env:', process.env.PRODUCTION_MODE);
  console.log('NODE_ENV env:', process.env.NODE_ENV);

  const engine = await prisma.engine.findUnique({
    where: { engineKey: 'stage1_orchestrator' },
  });
  console.log('Engine stage1_orchestrator:', engine);

  await prisma.$disconnect();
}

check().catch(console.error);
