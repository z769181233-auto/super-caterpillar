#!/usr/bin/env node
/**
 * Preflight Gate - 本地起跑线一致检查
 * 
 * 检查项：
 * - Node/pnpm 版本
 * - 环境变量
 * - 端口占用
 * - Docker/Redis/Postgres 可用性
 * - Prisma 生成物一致
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const errors = [];
const warnings = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      errors.push(`❌ ${name}: FAILED`);
    } else if (result === 'warning') {
      warnings.push(`⚠️  ${name}: WARNING`);
    } else {
      console.log(`✅ ${name}: OK`);
    }
  } catch (error) {
    errors.push(`❌ ${name}: ${error.message}`);
  }
}

// 1. Node 版本检查
check('Node version', () => {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (major < 18) {
    throw new Error(`Node version ${nodeVersion} is too old. Required: >= 18`);
  }
  return true;
});

// 2. pnpm 版本检查
check('pnpm version', () => {
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
    const major = parseInt(pnpmVersion.split('.')[0]);
    if (major < 8) {
      throw new Error(`pnpm version ${pnpmVersion} is too old. Required: >= 8`);
    }
    return true;
  } catch (error) {
    throw new Error('pnpm not found. Please install pnpm: npm install -g pnpm');
  }
});

// 3. 环境变量检查
check('Environment variables', () => {
  // DATABASE_URL is required for runtime, but optional for preflight (can be set later)
  const required = []; // No hard requirements for preflight
  const optional = ['DATABASE_URL', 'REDIS_URL', 'API_PORT', 'NODE_ENV'];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    warnings.push(`⚠️  Optional env vars not set: ${missingOptional.join(', ')}`);
    return 'warning';
  }
  
  return true;
});

// 3.5. 存储路径配置检查（必需）
check('Storage path configuration', () => {
  const hasRepoRoot = !!process.env.REPO_ROOT;
  const hasStorageRoot = !!process.env.STORAGE_ROOT;
  
  if (!hasRepoRoot && !hasStorageRoot) {
    throw new Error(
      'REPO_ROOT or STORAGE_ROOT must be set.\n' +
      '  Recommended: export REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"\n' +
      '  Or set: export STORAGE_ROOT="/path/to/storage"'
    );
  }
  
  if (hasRepoRoot && hasStorageRoot) {
    warnings.push(`⚠️  Both REPO_ROOT and STORAGE_ROOT are set. REPO_ROOT takes precedence.`);
    return 'warning';
  }
  
  return true;
});

// 4. 端口占用检查
check('Port availability', () => {
  const port = process.env.API_PORT || 3000;
  try {
    execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
    throw new Error(`Port ${port} is already in use`);
  } catch (error) {
    // lsof returns non-zero if port is free, which is what we want
    if (error.status === 0) {
      throw new Error(`Port ${port} is already in use`);
    }
    return true;
  }
});

// 5. Prisma 生成物检查
check('Prisma generated files', () => {
  const prismaClientPath = join(rootDir, 'packages/database/src/generated/prisma');
  if (!existsSync(prismaClientPath)) {
    throw new Error('Prisma client not generated. Run: pnpm -w --filter database prisma:generate');
  }
  
  const indexFile = join(prismaClientPath, 'index.js');
  if (!existsSync(indexFile) && !existsSync(join(prismaClientPath, 'index.mjs'))) {
    throw new Error('Prisma client index file not found');
  }
  
  return true;
});

// 6. 数据库连接检查（可选，如果 DATABASE_URL 存在）
check('Database connectivity', () => {
  if (!process.env.DATABASE_URL) {
    return 'warning'; // Skip if no DB URL
  }
  
  try {
    // Try to connect using psql or node script
    const testScript = `
      const { PrismaClient } = require('${join(rootDir, 'packages/database/src/generated/prisma')}');
      const prisma = new PrismaClient();
      prisma.$connect()
        .then(() => {
          console.log('OK');
          prisma.$disconnect();
          process.exit(0);
        })
        .catch((e) => {
          console.error('FAILED:', e.message);
          process.exit(1);
        });
    `;
    
    execSync(`node -e "${testScript.replace(/"/g, '\\"')}"`, {
      cwd: rootDir,
      stdio: 'ignore',
      timeout: 5000,
    });
    return true;
  } catch (error) {
    return 'warning'; // Database might not be running, just warn
  }
});

// 7. Redis 连接检查（可选）
check('Redis connectivity', () => {
  if (!process.env.REDIS_URL) {
    return 'warning'; // Skip if no Redis URL
  }
  
  try {
    // Simple Redis check (if redis-cli is available)
    execSync('redis-cli ping', { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch (error) {
    return 'warning'; // Redis might not be running, just warn
  }
});

// 8. 关键文件存在性检查
check('Key files existence', () => {
  const keyFiles = [
    'package.json',
    'pnpm-workspace.yaml',
    'packages/database/prisma/schema.prisma',
    'apps/api/src/main.ts',
  ];
  
  const missing = keyFiles.filter(file => !existsSync(join(rootDir, file)));
  if (missing.length > 0) {
    throw new Error(`Missing key files: ${missing.join(', ')}`);
  }
  
  return true;
});

// 输出结果
console.log('\n=== Preflight Check Summary ===\n');

if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach(w => console.log(`  ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('Errors:');
  errors.forEach(e => console.log(`  ${e}`));
  console.log('\n❌ Preflight check FAILED. Please fix the errors above.\n');
  process.exit(1);
} else {
  console.log('✅ All preflight checks passed!\n');
  process.exit(0);
}

