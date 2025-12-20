#!/usr/bin/env node
/**
 * 环境变量自检脚本
 * 用于快速检查环境变量文件是否存在，以及必需变量是否已设置
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.local');

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// 检查环境变量是否已设置（不打印值）
function checkEnvVar(key) {
  return process.env[key] ? 'SET' : 'NOT_SET';
}

// 加载 .env 文件（如果存在）
function loadEnvFile(filePath) {
  if (!fileExists(filePath)) {
    return {};
  }
  
  const env = {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
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
        env[key] = value;
      }
    }
  } catch (error) {
    // 忽略读取错误
  }
  
  return env;
}

function main() {
  console.log('========================================');
  console.log('环境变量自检');
  console.log('========================================');
  console.log(`当前工作目录: ${ROOT_DIR}`);
  console.log('');
  
  // 检查文件
  const envExists = fileExists(ENV_PATH);
  const envLocalExists = fileExists(ENV_LOCAL_PATH);
  
  console.log('文件检查：');
  console.log(`  .env:        ${envExists ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`  .env.local:  ${envLocalExists ? '✅ 存在' : '❌ 不存在'}`);
  console.log('');
  
  // 加载环境变量文件
  const envVars = {};
  if (envExists) {
    Object.assign(envVars, loadEnvFile(ENV_PATH));
  }
  if (envLocalExists) {
    Object.assign(envVars, loadEnvFile(ENV_LOCAL_PATH));
  }
  
  // 合并到 process.env（用于检查）
  for (const [key, value] of Object.entries(envVars)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  
  // 检查必需变量
  const requiredKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  
  console.log('必需变量检查：');
  for (const key of requiredKeys) {
    const status = checkEnvVar(key);
    const icon = status === 'SET' ? '✅' : '❌';
    console.log(`  ${key}: ${icon} ${status}`);
  }
  console.log('');
  
  // 总结
  const missingKeys = requiredKeys.filter(key => checkEnvVar(key) === 'NOT_SET');
  
  if (missingKeys.length === 0) {
    console.log('✅ 所有必需变量已设置');
    console.log('');
    console.log('可以启动服务：');
    console.log('  pnpm dev:api');
    console.log('  或');
    console.log('  pnpm dev');
  } else {
    console.log('❌ 缺失必需变量：');
    for (const key of missingKeys) {
      console.log(`  - ${key}`);
    }
    console.log('');
    console.log('解决方案：');
    console.log('  运行 pnpm env:init 初始化环境变量');
  }
  
  console.log('========================================');
  
  process.exit(missingKeys.length === 0 ? 0 : 1);
}

main();

