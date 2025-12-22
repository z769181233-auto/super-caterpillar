#!/usr/bin/env node
/**
 * 环境变量初始化脚本
 * 仅在 .env.local 不存在时生成并写入必需的环境变量
 * 
 * 用途：本地开发环境一键初始化
 * 注意：生成的密钥仅用于 DEV 本地开发，生产环境必须使用强密钥
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');

// 生成高强度随机密钥（48 bytes = 96 hex chars）
function generateSecret() {
  return crypto.randomBytes(48).toString('hex');
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// 检查值是否为占位符（需要替换）
function isPlaceholderValue(key, value) {
  if (!value || value.trim() === '') {
    return true;
  }
  
  // JWT_SECRET 和 JWT_REFRESH_SECRET 的占位符检测
  if (key === 'JWT_SECRET' || key === 'JWT_REFRESH_SECRET') {
    const lowerValue = value.toLowerCase();
    // 检测常见占位符模式
    if (lowerValue.includes('placeholder') ||
        lowerValue.includes('your-super-secret') ||
        lowerValue.includes('change-in-production') ||
        lowerValue === 'dev-only-placeholder' ||
        lowerValue.length < 32) { // 太短的密钥也视为占位符
      return true;
    }
  }
  
  return false;
}

// 解析 .env.local 文件，提取已有的 key=value
function parseEnvFile(filePath) {
  const env = {};
  if (!fileExists(filePath)) {
    return env;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // 解析 key=value（支持 key="value" 和 key=value）
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        // 移除引号（如果存在）
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  } catch (error) {
    console.warn(`警告：读取 ${filePath} 失败: ${error.message}`);
  }
  
  return env;
}

// 生成完整的 .env.local 内容
function generateFullEnvContent() {
  const jwtSecret = generateSecret();
  const jwtRefreshSecret = generateSecret();
  
  return `# Super Caterpillar Universe - 本地开发环境变量
# 此文件由 pnpm env:init 自动生成
# 注意：生成的密钥仅用于 DEV 本地开发，生产环境必须使用强密钥

# ============================================
# 必需变量（API/Worker 启动必需）
# ============================================

# JWT 密钥（自动生成，仅 DEV 本地使用）
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}

# 数据库连接（仅本地开发默认值，生产环境必须修改）
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scu?schema=public

# ============================================
# 可选变量（可按需修改）
# ============================================

# Node 环境
NODE_ENV=development

# API 配置
API_PORT=3000
API_HOST=localhost

# 前端 URL
FRONTEND_URL=http://localhost:3001

# JWT 过期时间
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Redis（可选）
REDIS_URL=redis://localhost:6379

# 应用信息
APP_NAME=Super Caterpillar Universe
APP_VERSION=1.0.0

# 安全配置
BCRYPT_SALT_ROUNDS=10

# HMAC 认证配置
HMAC_TIMESTAMP_WINDOW=300000
HMAC_SIGNATURE_ALGORITHM=sha256
`;
}

// 生成缺失的 key=value 行
function generateMissingKeys(env, missingKeys) {
  const lines = [];
  
  for (const key of missingKeys) {
    if (key === 'JWT_SECRET') {
      lines.push(`JWT_SECRET=${generateSecret()}`);
    } else if (key === 'JWT_REFRESH_SECRET') {
      lines.push(`JWT_REFRESH_SECRET=${generateSecret()}`);
    } else if (key === 'DATABASE_URL') {
      lines.push(`# 数据库连接（仅本地开发默认值，生产环境必须修改）`);
      lines.push(`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scu?schema=public`);
    }
  }
  
  return lines.join('\n');
}

function main() {
  console.log('========================================');
  console.log('环境变量初始化');
  console.log('========================================');
  console.log(`检查文件: ${ENV_LOCAL_PATH}`);
  console.log('');

  const requiredKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const fileExists = fs.existsSync(ENV_LOCAL_PATH);
  
  if (fileExists) {
    // 文件已存在：解析已有内容，补齐缺失的 key
    console.log('✅ .env.local 已存在，检查缺失项...');
    console.log('');
    
    const existingEnv = parseEnvFile(ENV_LOCAL_PATH);
    
    // 检查文件中是否有占位符值或重复的 key 行
    let content = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
    const lines = content.split('\n');
    const placeholderKeysInFile = [];
    const duplicateKeysInFile = []; // 记录有重复行的 key
    
    // 第一次遍历：检测占位符和重复行
    const keyOccurrences = {}; // 记录每个 key 出现的次数和位置
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (requiredKeys.includes(key)) {
          if (!keyOccurrences[key]) {
            keyOccurrences[key] = [];
          }
          keyOccurrences[key].push({ lineIndex: i, value, line });
          
          // 如果这一行是占位符，标记需要替换
          if (isPlaceholderValue(key, value)) {
            if (!placeholderKeysInFile.includes(key)) {
              placeholderKeysInFile.push(key);
            }
          }
        }
      }
    }
    
    // 检测重复的 key（出现次数 > 1）
    for (const key of requiredKeys) {
      if (keyOccurrences[key] && keyOccurrences[key].length > 1) {
        duplicateKeysInFile.push(key);
      }
    }
    
    // 检查缺失或占位符值（基于解析后的 env，用于追加缺失项）
    const missingKeys = requiredKeys.filter(key => {
      const value = existingEnv[key];
      return !value || value.trim() === '' || isPlaceholderValue(key, value);
    });
    
    // 如果文件中有占位符行或重复行，需要修复
    const keysToFix = [...new Set([...missingKeys, ...placeholderKeysInFile, ...duplicateKeysInFile])];
    
    if (keysToFix.length === 0) {
      console.log('✅ 所有必需变量已存在且有效，无需补充');
      console.log('');
      console.log('如需重新生成密钥，请先删除 .env.local 文件：');
      console.log(`  rm ${ENV_LOCAL_PATH}`);
      console.log('然后重新运行：');
      console.log('  pnpm env:init');
      process.exit(0);
    }
    
    // 补齐缺失的 key 或替换占位符
    const placeholderKeys = placeholderKeysInFile.length > 0 ? placeholderKeysInFile : missingKeys.filter(key => {
      const value = existingEnv[key];
      return value && value.trim() !== '' && isPlaceholderValue(key, value);
    });
    const trulyMissingKeys = missingKeys.filter(key => !placeholderKeys.includes(key) && (!existingEnv[key] || existingEnv[key].trim() === ''));
    
    if (placeholderKeys.length > 0) {
      console.log(`发现占位符值（需要替换）: ${placeholderKeys.join(', ')}`);
    }
    if (duplicateKeysInFile.length > 0) {
      console.log(`发现重复的变量行（需要清理）: ${duplicateKeysInFile.join(', ')}`);
    }
    if (trulyMissingKeys.length > 0) {
      console.log(`发现缺失的必需变量: ${trulyMissingKeys.join(', ')}`);
    }
    console.log('正在补齐/替换...');
    console.log('');
    
    try {
      // 如果存在占位符值或缺失项，需要修复文件
      if (keysToFix.length > 0) {
        // 读取原文件内容（已在上面读取）
        const newLines = [];
        const processedKeys = {}; // 记录已处理的 key（避免重复）
        
        for (const line of lines) {
          const trimmed = line.trim();
          let isKeyLine = false;
          let keyFound = null;
          let shouldReplace = false;
          let replacement = null;
          
          // 检查是否是必需变量的 key=value 行
          for (const key of requiredKeys) {
            const regex = new RegExp(`^${key}\\s*=`, 'i');
            if (regex.test(trimmed)) {
              isKeyLine = true;
              keyFound = key;
              
              // 如果这个 key 需要处理
              if (keysToFix.includes(key)) {
                if (!processedKeys[key]) {
                  // 第一次遇到这个 key
                  const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
                  if (match) {
                    let value = match[2];
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                      value = value.slice(1, -1);
                    }
                    if (isPlaceholderValue(key, value)) {
                      // 替换占位符为新的随机密钥
                      if (key === 'JWT_SECRET' || key === 'JWT_REFRESH_SECRET') {
                        replacement = `${key}=${generateSecret()}`;
                      } else if (key === 'DATABASE_URL') {
                        replacement = `# 数据库连接（仅本地开发默认值，生产环境必须修改）\n${key}=postgresql://postgres:postgres@localhost:5432/scu?schema=public`;
                      }
                      shouldReplace = true;
                    } else {
                      // 不是占位符，保留这一行
                      replacement = line;
                    }
                    processedKeys[key] = true;
                  }
                } else {
                  // 已经处理过这个 key，跳过后续的重复行
                  // 不添加到 newLines
                  break;
                }
              } else {
                // 这个 key 不需要处理，但需要检查是否重复
                if (processedKeys[key]) {
                  // 已经处理过这个 key，跳过重复行
                  // 不添加到 newLines
                  break;
                } else {
                  // 正常处理，记录这个 key 已存在
                  processedKeys[key] = true;
                  // 继续处理，添加到 newLines
                }
              }
              break;
            }
          }
          
          if (isKeyLine && keyFound && keysToFix.includes(keyFound) && processedKeys[keyFound]) {
            // 这是需要处理的 key，且已经处理过
            if (shouldReplace && replacement) {
              // 替换这一行
              if (replacement.includes('\n')) {
                // 多行替换（DATABASE_URL 带注释）
                newLines.push(...replacement.split('\n'));
              } else {
                newLines.push(replacement);
              }
            }
            // 如果 shouldReplace 为 false，说明这一行不是占位符，已经在上面的 else 分支处理了
          } else if (!isKeyLine || !processedKeys[keyFound]) {
            // 不是 key 行，或者是第一次遇到的 key（正常处理）
            newLines.push(line);
          }
          // 如果是重复的 key 行，不添加到 newLines（跳过）
        }
        
        // 写入替换后的内容
        fs.writeFileSync(ENV_LOCAL_PATH, newLines.join('\n'), 'utf8');
      }
      
      // 追加真正缺失的 key
      if (trulyMissingKeys.length > 0) {
        const missingContent = generateMissingKeys(existingEnv, trulyMissingKeys);
        const appendContent = '\n' + missingContent + '\n';
        fs.appendFileSync(ENV_LOCAL_PATH, appendContent, 'utf8');
      }
      
      console.log('✅ 已补齐/替换变量：');
      for (const key of missingKeys) {
        if (key === 'JWT_SECRET' || key === 'JWT_REFRESH_SECRET') {
          const action = placeholderKeys.includes(key) ? '已替换占位符为' : '已生成';
          console.log(`  - ${key}: ${action}（96 字符随机密钥）`);
        } else {
          const action = placeholderKeys.includes(key) ? '已替换占位符为' : '已添加';
          console.log(`  - ${key}: ${action}默认值`);
        }
      }
      console.log('');
      console.log('⚠️  注意：生成的密钥仅用于 DEV 本地开发');
      console.log('   生产环境必须使用强密钥，不要提交到 Git');
      console.log('');
      console.log('========================================');
      console.log('下一步：');
      console.log('========================================');
      console.log('1. 确认数据库连接字符串（如需要）：');
      console.log('   编辑 .env.local，修改 DATABASE_URL');
      console.log('');
      console.log('2. 启动 API 服务：');
      console.log('   pnpm dev:api');
      console.log('   或');
      console.log('   pnpm dev  # 启动 api + web');
      console.log('');
      console.log('3. 验证接口：');
      console.log('   node tools/security/hmac-ping.js');
      console.log('========================================');
      
      process.exit(0);
    } catch (error) {
      console.error('❌ 补齐 .env.local 失败：');
      console.error(error.message);
      console.error('');
      console.error('请检查：');
      console.error('  1. 是否有写入权限');
      console.error('  2. 磁盘空间是否充足');
      process.exit(1);
    }
  } else {
    // 文件不存在：创建并写入全部必需项
    console.log('📝 .env.local 不存在，正在创建...');
    console.log('');
    
    try {
      const content = generateFullEnvContent();
      fs.writeFileSync(ENV_LOCAL_PATH, content, 'utf8');
      
      console.log('✅ .env.local 已生成');
      console.log('');
      console.log('生成的内容：');
      console.log('  - JWT_SECRET: 已生成（96 字符随机密钥）');
      console.log('  - JWT_REFRESH_SECRET: 已生成（96 字符随机密钥）');
      console.log('  - DATABASE_URL: 默认本地 PostgreSQL（仅本地开发默认值）');
      console.log('');
      console.log('⚠️  注意：生成的密钥仅用于 DEV 本地开发');
      console.log('   生产环境必须使用强密钥，不要提交到 Git');
      console.log('');
      console.log('========================================');
      console.log('下一步：');
      console.log('========================================');
      console.log('1. 确认数据库连接字符串（如需要）：');
      console.log('   编辑 .env.local，修改 DATABASE_URL');
      console.log('');
      console.log('2. 启动 API 服务：');
      console.log('   pnpm dev:api');
      console.log('   或');
      console.log('   pnpm dev  # 启动 api + web');
      console.log('');
      console.log('3. 验证接口：');
      console.log('   node tools/security/hmac-ping.js');
      console.log('========================================');
      
      process.exit(0);
    } catch (error) {
      console.error('❌ 生成 .env.local 失败：');
      console.error(error.message);
      console.error('');
      console.error('请检查：');
      console.error('  1. 是否有写入权限');
      console.error('  2. 磁盘空间是否充足');
      process.exit(1);
    }
  }
}

main();

