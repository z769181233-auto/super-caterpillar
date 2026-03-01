import { PrismaClient } from '../../packages/database/src/generated/prisma';

// Safety Gate
if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  console.error('❌ ERROR: this script is strictly for DEVELOPMENT environment only.');
  process.exit(1);
}

if (process.env.ALLOW_DB_PATCH !== '1') {
  console.error('❌ ERROR: You must explicitly set ALLOW_DB_PATCH=1 to run this script.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Patching DB: Adding credits column if missing...');
    await prisma.$executeRaw`
            ALTER TABLE "organizations" 
            ADD COLUMN IF NOT EXISTS "credits" DOUBLE PRECISION NOT NULL DEFAULT 0;
        `;

    console.log('Patching DB: Adding type column if missing...');
    await prisma.$executeRaw`
            ALTER TABLE "organizations" 
            ADD COLUMN IF NOT EXISTS "type" TEXT;
        `;

    console.log('Patching DB: Adding billing_events.metadata if missing...');
    await prisma.$executeRaw`
            ALTER TABLE "billing_events" 
            ADD COLUMN IF NOT EXISTS "metadata" JSONB;
        `;

    console.log('Patching DB: Adding audit_logs.orgId if missing...');
    await prisma.$executeRaw`
            ALTER TABLE "audit_logs" 
            ADD COLUMN IF NOT EXISTS "orgId" TEXT;
        `;

    console.log('Patching DB: Adding UNIQUE INDEX on assets(ownerType, ownerId, type)...');
    // Use try-catch for index creation as IF NOT EXISTS syntax for INDEX is Postgres specific (v9.5+) but good to be safe
    try {
      await prisma.$executeRaw`
                CREATE UNIQUE INDEX IF NOT EXISTS "assets_ownerType_ownerId_type_key" 
                ON "assets"("ownerType", "ownerId", "type");
            `;
      console.log('✅ Added Asset Unique Index.');
    } catch (e) {
      console.error('⚠️ Could not add Asset Unique Index (might be duplicates):', e.message);
      // Don't fail the whole script, let verification fail if it really needs it
    }

    console.log('✅ DB Patch Complete.');
  } catch (e) {
    console.error('Failed to patch DB:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
