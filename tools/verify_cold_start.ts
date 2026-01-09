/**
 * Cold Start Verification Script (TypeScript version)
 * Purpose: Verify that migrations can be replayed on an empty database
 */

import { execSync } from 'child_process';
import { PrismaClient } from '../packages/database/src/generated/prisma';

const VERIFY_DB_NAME = `super_caterpillar_verify_${Date.now()}`;

function exec(command: string, options: { env?: Record<string, string>; cwd?: string } = {}) {
  const { env = {}, cwd = process.cwd() } = options;
  console.log(`$ ${command} (cwd: ${cwd})`);
  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
      cwd,
    });
  } catch (error: any) {
    console.error(`Command failed with exit code ${error.status}`);
    throw error;
  }
}

async function main() {
  console.log('=== Database Governance: Cold Start Verification ===\n');

  // Get base DATABASE_URL
  const originalUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev';
  const baseUrl = originalUrl.replace(/\/[^/]*$/, '');
  const verifyUrl = `${baseUrl}/${VERIFY_DB_NAME}`;

  console.log(`Original DB: ${originalUrl}`);
  console.log(`Verify DB: ${verifyUrl}\n`);

  // Step 1: Create database using Prisma's raw connection
  console.log('Step 1: Creating empty database...');
  const adminPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `${baseUrl}/postgres`,
      },
    },
  });

  try {
    await adminPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${VERIFY_DB_NAME}";`);
    await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${VERIFY_DB_NAME}";`);
    console.log('✅ Database created.\n');
  } catch (error: any) {
    console.error('Failed to create database:', error.message);
    throw error;
  } finally {
    await adminPrisma.$disconnect();
  }

  try {
    // Step 2: Run migrations
    console.log('Step 2: Running migrations (prisma migrate deploy)...');
    exec('pnpm prisma migrate deploy', {
      env: { DATABASE_URL: verifyUrl },
      cwd: './packages/database',
    });
    console.log('✅ Migrations applied.\n');

    // Step 3: Generate Prisma Client
    console.log('Step 3: Generating Prisma Client...');
    exec('pnpm prisma generate', { cwd: './packages/database' });
    console.log('✅ Client generated.\n');

    // Step 4: Build API
    console.log('Step 4: Building API...');
    exec('pnpm -F api build');
    console.log('✅ API built.\n');

    // Step 5: Run verification script
    console.log('Step 5: Running verify_stage10.ts...');
    exec('pnpm -w exec tsx scripts/verify_stage10.ts', { env: { DATABASE_URL: verifyUrl } });
    console.log('✅ Verification passed.\n');

    // Step 6: Run Stage 11 verifications
    console.log('Step 6: Running Stage 11 verifications...');

    console.log('  6.1: Signed URL verification (with flag)...');
    exec('pnpm -w exec tsx scripts/verify_signed_url.ts', {
      env: {
        DATABASE_URL: verifyUrl,
        FEATURE_SIGNED_URL_ENFORCED: 'true',
      },
    });
    console.log('  ✅ Signed URL verification passed.\n');

    console.log('  6.2: Text Safety verification (with flags)...');
    exec('pnpm -w exec tsx scripts/verify_text_safety.ts', {
      env: {
        DATABASE_URL: verifyUrl,
        FEATURE_TEXT_SAFETY_TRI_STATE: 'true',
        FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT: 'true',
        FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE: 'true',
      },
    });
    console.log('  ✅ Text Safety verification passed.\n');

    console.log('✅ All Stage 11 verifications passed.\n');
  } finally {
    // Step 7: Cleanup
    console.log('Step 7: Cleaning up...');
    const cleanupPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `${baseUrl}/postgres`,
        },
      },
    });

    try {
      await cleanupPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${VERIFY_DB_NAME}";`);
      console.log('✅ Database dropped.\n');
    } finally {
      await cleanupPrisma.$disconnect();
    }
  }

  console.log('=== Cold Start Verification PASSED ===');
  console.log('证明：整个过程未使用 patch_db.ts');
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
