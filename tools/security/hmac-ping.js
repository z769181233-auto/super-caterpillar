#!/usr/bin/env node
/**
 * HMAC Ping 验证脚本
 * 用于验证 GET /api/_internal/hmac-ping 接口是否生效且不需要 JWT
 */

const hmacLib = require('./hmac-lib');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// 环境检查
function checkEnvironment() {
  const requiredVars = ['JWT_SECRET', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error('========================================');
    console.error('❌ 环境变量缺失');
    console.error('========================================');
    console.error(`缺少必需的环境变量: ${missingVars.join(', ')}`);
    console.error('');
    console.error('解决方案：');
    console.error('1. 在仓库根目录创建 .env.local 文件');
    console.error('2. 从 .env.example 复制模板');
    console.error('3. 填入必需的环境变量：');
    console.error('   - JWT_SECRET: JWT 签名密钥（必需）');
    console.error('   - DATABASE_URL: 数据库连接字符串（必需）');
    console.error('');
    console.error('示例：');
    console.error('  cp .env.example .env.local');
    console.error('  # 编辑 .env.local，填入实际值');
    console.error('');
    console.error('注意：');
    console.error('  - .env.local 不会被提交到 Git（已在 .gitignore 中）');
    console.error('  - API 服务启动时会自动加载 .env.local 和 .env');
    console.error('========================================');
    process.exit(1);
  }
}

// 执行环境检查
checkEnvironment();

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'ak_worker_dev_0000000000000000';
const API_SECRET = process.env.API_SECRET || 'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';
const PATH = '/api/_internal/hmac-ping';

// 发送请求
function sendRequest(method, url, headers = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let responseBody;
        try {
          responseBody = JSON.parse(data);
        } catch {
          responseBody = { raw: data };
        }
        
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          body: responseBody,
          bodyText: data,
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        status: 0,
        statusText: 'NETWORK_ERROR',
        body: { error: error.message },
        bodyText: error.message,
      });
    });
    
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('HMAC Ping 验证');
  console.log('========================================');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Path: ${PATH}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('');

  // 生成 HMAC 头
  const headers = hmacLib.generateHmacHeaders(API_KEY, API_SECRET, 'GET', PATH, null);
  
  console.log('Request Headers:');
  console.log(`  X-Api-Key: ${headers['X-Api-Key']}`);
  console.log(`  X-Nonce: ${headers['X-Nonce']}`);
  console.log(`  X-Timestamp: ${headers['X-Timestamp']}`);
  console.log(`  X-Signature: ${headers['X-Signature']}`);
  console.log('');

  // 发送请求
  const result = await sendRequest('GET', `${API_BASE_URL}${PATH}`, headers);
  
  console.log('Response:');
  console.log(`  Status: ${result.status}`);
  console.log(`  Status Text: ${result.statusText}`);
  console.log(`  Body: ${JSON.stringify(result.body, null, 2)}`);
  console.log('');

  // 解析错误码
  let errorCode = null;
  if (result.body && typeof result.body === 'object') {
    if (result.body.error) {
      errorCode = result.body.error.code;
    }
  }

  // 判断结果
  console.log('========================================');
  console.log('验证结果');
  console.log('========================================');
  
  if (result.status === 200) {
    console.log('✅ 接口生效且不需要 JWT');
    console.log(`   Response: ${JSON.stringify(result.body)}`);
  } else if (result.status === 401) {
    if (errorCode === '4003' || errorCode === '4004') {
      console.log('❌ HMAC 验证失败');
      console.log(`   Error Code: ${errorCode}`);
    } else {
      console.log('❌ 接口被 JWT/权限 Guard 拦截');
      console.log(`   Status: ${result.status}`);
      console.log(`   Body: ${result.bodyText.substring(0, 200)}`);
      console.log('   需要检查：');
      console.log('     1. Controller 是否误加了 @UseGuards(JwtAuthGuard)');
      console.log('     2. 是否存在全局 APP_GUARD 的 JwtAuthGuard');
      console.log('     3. 接口是否在需要 JWT 的 Controller 中');
    }
  } else if (result.status === 404) {
    console.log('❌ 接口未生效（404 Not Found）');
    console.log('   可能原因：');
    console.log('     1. API 服务未重启');
    console.log('     2. 代码未编译');
    console.log('     3. Controller 未注册');
    console.log('     4. 路由路径错误');
  } else {
    console.log(`❌ 未知错误: ${result.status}`);
    console.log(`   Body: ${result.bodyText.substring(0, 200)}`);
  }
  
  console.log('========================================');
  
  process.exit(result.status === 200 ? 0 : 1);
}

main().catch(error => {
  console.error('错误:', error.message);
  console.error(error.stack);
  process.exit(1);
});

