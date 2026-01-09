#!/usr/bin/env node
/**
 * Cold Start Verification Script (Node.js version)
 * Purpose: Verify that migrations can be replayed on an empty database
 */

const { execSync } = require('child_process');
const { PrismaClient } = require('./packages/database/src/generated/prisma');

const VERIFY_DB_NAME = `super_caterpillar_verify_${Date.now()}`;

function exec(command, env = {}) {
  console.log(`$ ${command}`);
  try {
    const result = execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
      cwd: __dirname,
    });
    return result;
  } catch (error) {
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
  } catch (error) {
    console.error('Failed to create database:', error.message);
    throw error;
  } finally {
    await adminPrisma.$disconnect();
  }

  try {
    // Step 2: Run migrations
    console.log('Step 2: Running migrations (prisma migrate deploy)...');
    exec('pnpm prisma migrate deploy', { DATABASE_URL: verifyUrl, cwd: './packages/database' });
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
    exec('pnpm -w exec tsx scripts/verify_stage10.ts', { DATABASE_URL: verifyUrl });
    console.log('✅ Verification passed.\n');
  } finally {
    // Step 6: Cleanup
    console.log('Step 6: Cleaning up...');
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
