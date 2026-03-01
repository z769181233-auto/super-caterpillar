#!/usr/bin/env ts-node

/**
 * CE API Smoke Test
 * 最小 e2e 验证脚本（不依赖 Worker 真跑）
 *
 * 验证：
 * - API 可创建 job
 * - traceId 正常
 * - Safety Hook 正常工作
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';
const API_SECRET = process.env.API_SECRET || 'test-api-secret';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];

/**
 * 生成 HMAC 签名（简化版，实际应使用完整实现）
 */
function generateHmacHeaders(method: string, path: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Date.now()}_${Math.random()}`;
  const contentSha256 = require('crypto').createHash('sha256').update(body).digest('hex');

  // 简化版签名（实际应使用完整 v2 规范）
  const canonicalString = `v2\n${method}\n${path}\n${API_KEY}\n${timestamp}\n${nonce}\n${contentSha256}\n`;
  const signature = require('crypto')
    .createHmac('sha256', API_SECRET)
    .update(canonicalString)
    .digest('hex');

  return {
    'X-Api-Key': API_KEY,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Content-SHA256': contentSha256,
    'X-Signature': signature,
    'Content-Type': 'application/json',
  };
}

/**
 * 发送 HTTP 请求
 */
function request(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const bodyString = body ? JSON.stringify(body) : '';
    const headers = generateHmacHeaders(method, path, bodyString);

    const options = {
      method,
      headers,
    };

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (bodyString) {
      req.write(bodyString);
    }

    req.end();
  });
}

/**
 * 测试 1: POST /story/parse (CE06)
 */
async function testCE06() {
  const testName = 'CE06: POST /story/parse';
  try {
    const response = await request('POST', '/api/story/parse', {
      rawText: '这是一个测试小说文本。',
      projectId: 'test-project-id',
      novelTitle: '测试小说',
      novelAuthor: '测试作者',
    });

    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.jobId && response.body.traceId) {
        results.push({
          name: testName,
          passed: true,
          response: response.body,
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        return true;
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Missing jobId or traceId',
          response: response.body,
        });
        console.log(`❌ ${testName}: FAILED - Missing jobId or traceId`);
        return false;
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        response: response.body,
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return false;
  }
}

/**
 * 测试 2: POST /text/visual-density (CE03)
 */
async function testCE03() {
  const testName = 'CE03: POST /text/visual-density';
  try {
    const response = await request('POST', '/api/text/visual-density', {
      text: '这是一个测试文本，用于视觉密度分析。',
      projectId: 'test-project-id',
    });

    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.jobId && response.body.traceId) {
        results.push({
          name: testName,
          passed: true,
          response: response.body,
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        return true;
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Missing jobId or traceId',
          response: response.body,
        });
        console.log(`❌ ${testName}: FAILED - Missing jobId or traceId`);
        return false;
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        response: response.body,
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return false;
  }
}

/**
 * 测试 3: POST /text/enrich (CE04) - Safety Pass
 */
async function testCE04SafetyPass() {
  const testName = 'CE04: POST /text/enrich (Safety Pass)';
  try {
    const response = await request('POST', '/api/text/enrich', {
      text: '这是一个正常的测试文本，用于视觉增强。',
      projectId: 'test-project-id',
    });

    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.jobId && response.body.traceId && response.body.status !== 'FAILED') {
        results.push({
          name: testName,
          passed: true,
          response: response.body,
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        console.log(`   status: ${response.body.status}`);
        return true;
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Missing jobId/traceId or status is FAILED',
          response: response.body,
        });
        console.log(`❌ ${testName}: FAILED - Missing jobId/traceId or status is FAILED`);
        return false;
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        response: response.body,
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return false;
  }
}

/**
 * 测试 4: POST /text/enrich (CE04) - Safety Fail
 */
async function testCE04SafetyFail() {
  const testName = 'CE04: POST /text/enrich (Safety Fail)';
  try {
    // 使用包含黑名单关键词的文本（根据 TextSafetyService 的黑名单）
    const response = await request('POST', '/api/text/enrich', {
      text: '这是一个包含暴力内容的测试文本。',
      projectId: 'test-project-id',
    });

    // Safety Fail 应该返回 FAILED 状态
    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.status === 'FAILED' && response.body.reason === 'SAFETY_CHECK_FAILED') {
        results.push({
          name: testName,
          passed: true,
          response: response.body,
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        console.log(`   status: ${response.body.status}`);
        console.log(`   reason: ${response.body.reason}`);
        console.log(`   safetyFlags: ${response.body.safetyFlags?.join(', ')}`);
        return true;
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Expected FAILED status with SAFETY_CHECK_FAILED reason',
          response: response.body,
        });
        console.log(
          `❌ ${testName}: FAILED - Expected FAILED status with SAFETY_CHECK_FAILED reason`
        );
        return false;
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        response: response.body,
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('=== CE API Smoke Test ===\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  await testCE06();
  await testCE03();
  await testCE04SafetyPass();
  await testCE04SafetyFail();

  console.log('\n=== Test Summary ===');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
