#!/usr/bin/env node
/**
 * HMAC 安全验证脚本
 * 对 3 个接口进行 4 组用例测试（共 12 组）
 */

const fs = require('fs');
const path = require('path');
const hmacLib = require('./hmac-lib');

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';
const API_SECRET = process.env.API_SECRET || 'test-api-secret';
const PROJECT_ID = process.env.PROJECT_ID || 'test-project-id';

const LOG_FILE = path.join(__dirname, '../../docs/_risk/security_hmac_verify.log');

// 确保日志目录存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(logLine.trim());
}

// 发送请求（使用 node-fetch 或原生 http）
async function sendRequest(method, url, body, headers = {}) {
  const bodyString = body ? JSON.stringify(body) : '';
  const http = require('http');
  const https = require('https');
  const { URL } = require('url');
  
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
    
    if (bodyString) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }
    
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
          responseBody = data;
        }
        
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          body: responseBody,
          bodyText: data.substring(0, 300),
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        status: 0,
        statusText: 'NETWORK_ERROR',
        body: { error: error.message },
        bodyText: error.message.substring(0, 300),
      });
    });
    
    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

// 测试用例
async function testCase(name, method, path, body, headers, expectedErrorCode) {
  log(`\n=== ${name} ===`);
  log(`URL: ${method} ${API_BASE_URL}${path}`);
  
  // 检查 headers
  const hasApiKey = headers['X-Api-Key'] || headers['x-api-key'] ? 'present' : 'missing';
  const hasNonce = headers['X-Nonce'] || headers['x-nonce'] ? 'present' : 'missing';
  const hasTimestamp = headers['X-Timestamp'] || headers['x-timestamp'] ? 'present' : 'missing';
  const hasSignature = headers['X-Signature'] || headers['x-signature'] ? 'present' : 'missing';
  
  log(`Headers: X-Api-Key=${hasApiKey}, X-Nonce=${hasNonce}, X-Timestamp=${hasTimestamp}, X-Signature=${hasSignature}`);
  
  if (hasNonce === 'present') {
    log(`Nonce: ${headers['X-Nonce'] || headers['x-nonce']}`);
  }
  if (hasTimestamp === 'present') {
    log(`Timestamp: ${headers['X-Timestamp'] || headers['x-timestamp']}`);
  }

  const result = await sendRequest(method, `${API_BASE_URL}${path}`, body, headers);
  
  log(`Status Code: ${result.status}`);
  log(`Response Body (first 300 chars): ${result.bodyText}`);
  
  // 解析错误码
  let errorCode = null;
  let errorMessage = null;
  if (result.body && typeof result.body === 'object') {
    if (result.body.error) {
      errorCode = result.body.error.code;
      errorMessage = result.body.error.message;
    }
  }
  
  log(`Error Code: ${errorCode || 'N/A'}`);
  if (errorMessage) {
    log(`Error Message: ${errorMessage}`);
  }
  
  // 按 error.code 判断是否通过
  let passed = false;
  if (expectedErrorCode === null) {
    // 正常签名：不应出现 4003 或 4004
    passed = errorCode !== '4003' && errorCode !== '4004';
    log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'} (正常签名不应出现 error.code=4003/4004, got: ${errorCode || 'none'})`);
  } else {
    // 期望特定错误码
    passed = errorCode === expectedErrorCode;
    log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'} (expected error.code=${expectedErrorCode}, got: ${errorCode || 'none'})`);
  }
  
  return { name, passed, status: result.status, errorCode, errorMessage, expectedErrorCode };
}

// 主测试函数
async function main() {
  log('========================================');
  log('HMAC 安全验证测试');
  log('========================================');
  log(`API Base URL: ${API_BASE_URL}`);
  log(`Project ID: ${PROJECT_ID}`);
  log(`API Key: ${API_KEY.substring(0, 8)}...`);
  log('');

  const results = [];

  // 接口列表（注意：需要 /api 前缀）
  const endpoints = [
    { method: 'POST', path: `/api/projects/${PROJECT_ID}/novel/import-file`, body: null },
    { method: 'POST', path: `/api/projects/${PROJECT_ID}/novel/import`, body: { title: 'Test Novel', rawText: 'Test content' } },
    { method: 'POST', path: `/api/projects/${PROJECT_ID}/novel/analyze`, body: {} },
  ];

  // 为每个接口执行 4 组测试
  for (const endpoint of endpoints) {
    const endpointName = endpoint.path.split('/').pop();
    
    // 1. 不带签名头
    results.push(await testCase(
      `${endpointName} - 不带签名头`,
      endpoint.method,
      endpoint.path,
      endpoint.body,
      {},
      '4003' // 期望 error.code=4003 "Missing HMAC headers"
    ));

    // 2. timestamp 过期（当前时间 -10 分钟，秒级）
    const expiredTimestamp = String(hmacLib.getCurrentTimestamp() - 600); // 10分钟前
    const nonce1 = hmacLib.generateNonce();
    const message1 = hmacLib.buildMessage(endpoint.method, endpoint.path, expiredTimestamp, nonce1, endpoint.body);
    const signature1 = hmacLib.computeSignature(API_SECRET, message1);
    
    results.push(await testCase(
      `${endpointName} - timestamp 过期`,
      endpoint.method,
      endpoint.path,
      endpoint.body,
      {
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce1,
        'X-Timestamp': expiredTimestamp,
        'X-Signature': signature1,
      },
      '4003' // 期望 error.code=4003 "Timestamp out of window"
    ));

    // 3. 重复 nonce（使用同一个 nonce 两次）
    const validTimestamp = String(hmacLib.getCurrentTimestamp());
    const nonce2 = hmacLib.generateNonce();
    const message2 = hmacLib.buildMessage(endpoint.method, endpoint.path, validTimestamp, nonce2, endpoint.body);
    const signature2 = hmacLib.computeSignature(API_SECRET, message2);
    
    // 第一次请求（应该通过 HMAC 验证）
    const firstResult = await testCase(
      `${endpointName} - 正常签名（第一次，用于后续重复nonce测试）`,
      endpoint.method,
      endpoint.path,
      endpoint.body,
      {
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce2,
        'X-Timestamp': validTimestamp,
        'X-Signature': signature2,
      },
      null // 正常签名：不应出现 4003/4004
    );
    results.push(firstResult);

    // 等待1秒后重复使用同一个 nonce
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newTimestamp = String(hmacLib.getCurrentTimestamp());
    const message3 = hmacLib.buildMessage(endpoint.method, endpoint.path, newTimestamp, nonce2, endpoint.body);
    const signature3 = hmacLib.computeSignature(API_SECRET, message3);
    
    results.push(await testCase(
      `${endpointName} - 重复 nonce`,
      endpoint.method,
      endpoint.path,
      endpoint.body,
      {
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce2, // 重复使用
        'X-Timestamp': newTimestamp,
        'X-Signature': signature3,
      },
      '4004' // 期望 error.code=4004 "Nonce already used"
    ));

    // 4. 正常签名
    const validTimestamp2 = String(hmacLib.getCurrentTimestamp());
    const nonce4 = hmacLib.generateNonce();
    const message4 = hmacLib.buildMessage(endpoint.method, endpoint.path, validTimestamp2, nonce4, endpoint.body);
    const signature4 = hmacLib.computeSignature(API_SECRET, message4);
    
    results.push(await testCase(
      `${endpointName} - 正常签名`,
      endpoint.method,
      endpoint.path,
      endpoint.body,
      {
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce4,
        'X-Timestamp': validTimestamp2,
        'X-Signature': signature4,
      },
      null // 正常签名：不应出现 4003/4004
    ));
  }

  // 汇总
  log('\n========================================');
  log('测试汇总');
  log('========================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  log(`总测试数: ${total}`);
  log(`通过: ${passed}`);
  log(`失败: ${failed}`);
  
  log('\n详细结果:');
  results.forEach(r => {
    const expected = r.expectedErrorCode === null ? 'no 4003/4004' : `error.code=${r.expectedErrorCode}`;
    log(`  ${r.name}: ${r.passed ? '✅' : '❌'} (status: ${r.status}, error.code: ${r.errorCode || 'none'}, expected: ${expected})`);
  });
  
  // 按用例类型统计
  const missingHeader = results.filter(r => r.name.includes('不带签名头'));
  const expiredTimestamp = results.filter(r => r.name.includes('timestamp 过期'));
  const duplicateNonce = results.filter(r => r.name.includes('重复 nonce'));
  const validSignature = results.filter(r => r.name.includes('正常签名') && !r.name.includes('第一次'));
  
  log('\n按用例类型统计:');
  log(`  不带签名头: ${missingHeader.filter(r => r.passed).length}/${missingHeader.length} 通过`);
  log(`  timestamp 过期: ${expiredTimestamp.filter(r => r.passed).length}/${expiredTimestamp.length} 通过`);
  log(`  重复 nonce: ${duplicateNonce.filter(r => r.passed).length}/${duplicateNonce.length} 通过`);
  log(`  正常签名: ${validSignature.filter(r => r.passed).length}/${validSignature.length} 通过`);
  
  // 输出关键结论
  log('\n关键结论:');
  if (missingHeader.every(r => r.passed) && expiredTimestamp.every(r => r.passed) && duplicateNonce.every(r => r.passed)) {
    log('  ✅ HMAC missing / expired / replay 验证通过');
  } else {
    log('  ❌ HMAC missing / expired / replay 验证失败');
  }
  if (validSignature.some(r => r.passed)) {
    log('  ✅ HMAC 正常签名用例通过（error.code 不是 4003/4004）');
  } else {
    log('  ❌ HMAC 正常签名用例失败（仍出现 error.code=4003/4004）');
  }
  
  log('\n========================================');
  log('测试完成');
  log('========================================');
}

// 运行测试
main().catch(error => {
  log(`\n错误: ${error.message}`);
  log(error.stack);
  process.exit(1);
});

