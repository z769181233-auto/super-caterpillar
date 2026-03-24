import { PrismaClient } from '../../packages/database/src/generated/prisma';

// Safety Gates (DEV ONLY)
if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  console.error('❌ ERROR: This script is strictly for DEVELOPMENT environment only.');
  process.exit(1);
}

if (process.env.ALLOW_DB_PATCH !== '1') {
  console.error('❌ ERROR: You must explicitly set ALLOW_DB_PATCH=1 to run this script.');
  process.exit(1);
}

const prisma = new PrismaClient({});

async function main() {
  // Step 1: Create enum
  await prisma.$executeRawUnsafe(
    `CREATE TYPE IF NOT EXISTS text_safety_decision AS ENUM ('PASS', 'WARN', 'BLOCK')`
  );
  console.log('✅ Created text_safety_decision enum');

  // Step 2: Create table
  await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS text_safety_results (
            id TEXT PRIMARY KEY,
            "resourceType" TEXT NOT NULL,
            "resourceId" TEXT NOT NULL,
            decision text_safety_decision NOT NULL,
            "riskLevel" risk_level NOT NULL,
            flags JSONB DEFAULT '[]',
            reasons JSONB DEFAULT '[]',
            "sanitizedDigest" TEXT,
            "traceId" TEXT,
            "createdAt" TIMESTAMP DEFAULT NOW()
        )
    `);
  console.log('✅ Created text_safety_results table');

  // Step 3: Create indexes
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS text_safety_results_resourceType_resourceId_idx ON text_safety_results("resourceType", "resourceId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS text_safety_results_decision_createdAt_idx ON text_safety_results(decision, "createdAt" DESC)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS text_safety_results_riskLevel_createdAt_idx ON text_safety_results("riskLevel", "createdAt" DESC)`
  );
  console.log('✅ Created indexes');

  console.log('✅ TextSafetyResult table setup complete');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
