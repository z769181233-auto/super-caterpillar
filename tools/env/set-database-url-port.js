#!/usr/bin/env node
/**
 * 安全地更新 .env.local 中的 DATABASE_URL 端口
 * 仅替换 host:port 中的 port，保留其他内容
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');

function parseArgs() {
  const args = process.argv.slice(2);
  let port = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      break;
    }
  }

  if (!port || isNaN(port) || port < 1 || port > 65535) {
    console.error('❌ 错误：无效的端口号');
    console.error('');
    console.error('用法: node tools/env/set-database-url-port.js --port <PORT>');
    console.error('示例: node tools/env/set-database-url-port.js --port 5433');
    process.exit(1);
  }

  return port;
}

function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      username: parsed.username,
      password: parsed.password,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
    };
  } catch (error) {
    throw new Error(`无法解析 DATABASE_URL: ${error.message}`);
  }
}

function buildDatabaseUrl(parsed, newPort) {
  // 构建新的 URL
  const portPart = newPort ? `:${newPort}` : '';

  // 构建认证部分
  let authPart = '';
  if (parsed.username && parsed.password) {
    authPart = `${parsed.username}:${parsed.password}@`;
  } else if (parsed.username) {
    authPart = `${parsed.username}@`;
  }

  // 组合 URL
  const newUrl = `${parsed.protocol}//${authPart}${parsed.hostname}${portPart}${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`;
  return newUrl;
}

function main() {
  const newPort = parseArgs();

  // 1. 检查文件是否存在
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    console.error('❌ 错误：.env.local 文件不存在');
    console.error('');
    console.error('请先运行: pnpm env:init');
    process.exit(1);
  }

  // 2. 读取文件内容
  let content;
  try {
    content = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
  } catch (error) {
    console.error('❌ 错误：无法读取 .env.local 文件');
    console.error(`   原因: ${error.message}`);
    process.exit(1);
  }

  // 3. 查找并替换 DATABASE_URL
  const lines = content.split('\n');
  let found = false;
  let updated = false;

  const newLines = lines.map((line, index) => {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    // 匹配 DATABASE_URL=...
    const match = trimmed.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (match) {
      found = true;
      const urlValue = match[1];

      // 移除引号（如果存在）
      let cleanUrl = urlValue;
      if (
        (urlValue.startsWith('"') && urlValue.endsWith('"')) ||
        (urlValue.startsWith("'") && urlValue.endsWith("'"))
      ) {
        cleanUrl = urlValue.slice(1, -1);
      }

      try {
        // 解析 URL
        const parsed = parseDatabaseUrl(cleanUrl);
        const oldPort = parsed.port || '5432';

        // 如果端口相同，不需要更新
        if (oldPort === String(newPort)) {
          return line;
        }

        // 构建新 URL
        const newUrl = buildDatabaseUrl(parsed, newPort);

        // 保持原有的引号格式
        let newValue = newUrl;
        if (urlValue.startsWith('"') && urlValue.endsWith('"')) {
          newValue = `"${newUrl}"`;
        } else if (urlValue.startsWith("'") && urlValue.endsWith("'")) {
          newValue = `'${newUrl}'`;
        }

        // 保持原有的格式（缩进、注释等）
        // 提取等号前的部分（包括缩进）
        const equalIndex = line.indexOf('=');
        const prefix = line.substring(0, equalIndex);

        // 提取等号后的部分，查找注释
        const afterEqual = line.substring(equalIndex + 1);
        const commentMatch = afterEqual.match(/\s*(#.*)$/);
        const comment = commentMatch ? commentMatch[1] : '';

        // 构建新行
        updated = true;
        const newLine = `${prefix}=${newValue}${comment}`;
        return newLine.trimEnd() || newLine;
      } catch (error) {
        console.error(`❌ 错误：无法解析第 ${index + 1} 行的 DATABASE_URL`);
        console.error(`   原因: ${error.message}`);
        console.error(`   内容: ${line}`);
        process.exit(1);
      }
    }

    return line;
  });

  // 4. 检查是否找到 DATABASE_URL
  if (!found) {
    console.error('❌ 错误：.env.local 中未找到 DATABASE_URL');
    console.error('');
    console.error('请确保 .env.local 包含 DATABASE_URL 配置');
    process.exit(1);
  }

  // 5. 如果已更新，写入文件
  if (updated) {
    try {
      fs.writeFileSync(ENV_LOCAL_PATH, newLines.join('\n'), 'utf8');
      console.log(`✅ 已更新 .env.local 中的 DATABASE_URL 端口为 ${newPort}`);
    } catch (error) {
      console.error('❌ 错误：无法写入 .env.local 文件');
      console.error(`   原因: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️  DATABASE_URL 端口已经是 ${newPort}，无需更新`);
  }
}

main();
