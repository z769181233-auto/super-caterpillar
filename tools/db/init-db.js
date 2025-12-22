#!/usr/bin/env node
/**
 * 初始化数据库
 * 1. 等待数据库就绪
 * 2. 确保数据库存在
 * 3. 运行 Prisma migrate 或 db push
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 加载环境变量（必须在导入 pg 之前）
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scu?schema=public';

function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      database: parsed.pathname.slice(1).split('?')[0],
      user: parsed.username,
      password: parsed.password,
    };
  } catch (error) {
    return {
      host: 'localhost',
      port: 5432,
      database: 'scu',
      user: 'postgres',
      password: 'postgres',
    };
  }
}

async function ensureDatabaseExists() {
  const config = parseDatabaseUrl(DATABASE_URL);
  const adminClient = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres', // 连接到 postgres 数据库来创建目标数据库
  });

  try {
    await adminClient.connect();
    
    // 检查数据库是否存在
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database]
    );

    if (result.rows.length === 0) {
      console.log(`📦 创建数据库: ${config.database}`);
      await adminClient.query(`CREATE DATABASE "${config.database}"`);
      console.log(`✅ 数据库已创建: ${config.database}`);
    } else {
      console.log(`✅ 数据库已存在: ${config.database}`);
    }

    await adminClient.end();
  } catch (error) {
    console.error('❌ 创建数据库失败:', error.message);
    await adminClient.end().catch(() => {});
    process.exit(1);
  }
}

function hasMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../packages/database/prisma/migrations');
  if (!fs.existsSync(migrationsDir)) {
    return false;
  }
  const migrations = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => dirent.name.match(/^\d{14}_/)); // Prisma migration 命名格式
  return migrations.length > 0;
}

async function isDatabaseEmpty() {
  const config = parseDatabaseUrl(DATABASE_URL);
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  try {
    await client.connect();
    // 检查是否有表
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    await client.end();
    return parseInt(result.rows[0].count, 10) === 0;
  } catch (error) {
    await client.end().catch(() => {});
    // 如果查询失败，假设数据库为空
    return true;
  }
}

async function main() {
  console.log('========================================');
  console.log('数据库初始化');
  console.log('========================================');
  console.log('');

  // 1. 等待数据库就绪
  console.log('步骤 1/3: 等待数据库就绪...');
  console.log('');
  try {
    execSync('node tools/db/wait-postgres.js', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..'),
    });
  } catch (error) {
    console.error('');
    console.error('❌ 数据库未就绪，初始化失败');
    console.error('');
    console.error('请先确保数据库容器正在运行：');
    console.error('  pnpm db:up');
    console.error('');
    process.exit(1);
  }
  console.log('');

  // 2. 确保数据库存在
  console.log('步骤 2/3: 确保数据库存在...');
  await ensureDatabaseExists();
  console.log('');

  // 3. 运行 Prisma migrate 或 db push
  console.log('步骤 3/3: 运行 Prisma 迁移...');
  const hasMigrationsDir = hasMigrations();
  const dbEmpty = await isDatabaseEmpty();
  
  try {
    // 如果数据库为空，优先使用 db push（更安全，不需要 shadow database）
    if (dbEmpty) {
      console.log('📦 检测到数据库为空，使用 db push（更安全）...');
      execSync('pnpm -w --filter database db:push', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../..'),
        env: {
          ...process.env,
          DATABASE_URL,
        },
      });
    } else if (hasMigrationsDir) {
      console.log('📦 检测到 migrations 目录且数据库非空，使用 migrate dev...');
      execSync('pnpm -w --filter database db:migrate:dev', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../..'),
        env: {
          ...process.env,
          DATABASE_URL,
        },
      });
    } else {
      console.log('📦 未检测到 migrations 目录，使用 db push...');
      execSync('pnpm -w --filter database db:push', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../..'),
        env: {
          ...process.env,
          DATABASE_URL,
        },
      });
    }
    console.log('');
    console.log('✅ 数据库初始化完成');
    console.log('');
    console.log('========================================');
    console.log('下一步：');
    console.log('========================================');
    console.log('运行 pnpm -w --filter api dev 启动 API 服务');
    console.log('========================================');
  } catch (error) {
    console.error('');
    console.error('❌ Prisma 操作失败');
    console.error('');
    console.error('请检查：');
    console.error('  1. DATABASE_URL 配置是否正确');
    console.error('  2. 数据库连接是否正常');
    console.error('  3. Prisma schema 是否有语法错误');
    process.exit(1);
  }
}

main();

