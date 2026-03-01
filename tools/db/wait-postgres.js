#!/usr/bin/env node
/**
 * 等待 PostgreSQL 数据库就绪
 * 循环尝试连接数据库，最多等待 30 秒
 */

const path = require('path');

// 加载环境变量（必须在导入 pg 之前）
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scu?schema=public';
const MAX_WAIT_MS = 30000; // 30 秒
const RETRY_INTERVAL_MS = 1000; // 1 秒

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
    // 如果解析失败，使用默认值
    return {
      host: 'localhost',
      port: 5432,
      database: 'scu',
      user: 'postgres',
      password: 'postgres',
    };
  }
}

async function testConnection() {
  const config = parseDatabaseUrl(DATABASE_URL);
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres', // 先连接 postgres 数据库（因为目标数据库可能不存在）
    connectionTimeoutMillis: 2000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  let attempt = 0;
  const maxAttempts = Math.ceil(MAX_WAIT_MS / RETRY_INTERVAL_MS);

  console.log('==========================================');
  console.log('等待 PostgreSQL 数据库就绪');
  console.log('==========================================');
  console.log('');
  console.log(`⏳ 正在连接数据库（最多等待 ${MAX_WAIT_MS / 1000} 秒）...`);
  console.log('');

  while (Date.now() - startTime < MAX_WAIT_MS) {
    attempt++;
    const connected = await testConnection();

    if (connected) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ 数据库连接成功！`);
      console.log(`   尝试次数: ${attempt}`);
      console.log(`   耗时: ${elapsed} 秒`);
      console.log('');
      console.log('==========================================');
      process.exit(0);
    }

    // 显示进度（每 5 次尝试显示一次）
    if (attempt % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   尝试 ${attempt}/${maxAttempts}... (已等待 ${elapsed} 秒)`);
    }

    // 等待后重试
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error('');
  console.error('==========================================');
  console.error('❌ 错误：等待数据库超时');
  console.error('==========================================');
  console.error('');
  console.error(`已等待 ${elapsed} 秒（最多 ${MAX_WAIT_MS / 1000} 秒），数据库仍未就绪。`);
  console.error('');
  console.error('请按以下步骤检查：');
  console.error('');
  console.error('1. 检查 Docker 容器是否正在运行：');
  console.error('   docker ps | grep scu-postgres');
  console.error('');
  console.error('2. 如果容器未运行，启动它：');
  console.error('   docker start scu-postgres');
  console.error('');
  console.error('3. 检查容器日志（查看错误信息）：');
  console.error('   docker logs scu-postgres');
  console.error('');
  console.error('4. 检查端口 5432 是否被占用：');
  console.error('   lsof -i :5432  # macOS');
  console.error('   或');
  console.error('   netstat -tuln | grep 5432  # Linux');
  console.error('');
  console.error('5. 检查 DATABASE_URL 配置：');
  console.error('   查看 .env.local 文件中的 DATABASE_URL 是否正确');
  console.error('');
  console.error('6. 如果问题持续，尝试重启容器：');
  console.error('   docker restart scu-postgres');
  console.error('');
  console.error('==========================================');
  process.exit(1);
}

main();
