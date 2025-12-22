#!/usr/bin/env ts-node

/**
 * CE Core Commercialization Smoke Test
 * 验证 CE06/CE03/CE04 API 端点、Safety Hook、Quality Metrics 写入
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { createHmac, randomBytes } from 'crypto';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';
const API_SECRET = process.env.API_SECRET || 'test-api-secret';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
  evidence?: {
    statusCode?: number;
    body?: any;
    traceId?: string;
    jobId?: string;
  };
}

const results: TestResult[] = [];

/**
 * 生成 HMAC 签名（v2 规范）
 */
function generateHmacHeaders(method: string, path: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Date.now()}_${Math.random()}`;
  const contentSha256 = require('crypto').createHash('sha256').update(body, 'utf8').digest('hex');

  // v2 规范：v2\n{METHOD}\n{PATH}\n{API_KEY}\n{TIMESTAMP}\n{NONCE}\n{CONTENT_SHA256}\n
  const canonicalString = `v2\n${method}\n${path}\n${API_KEY}\n${timestamp}\n${nonce}\n${contentSha256}\n`;
  const signature = createHmac('sha256', API_SECRET).update(canonicalString, 'utf8').digest('hex');

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
 * 测试 1: POST /api/story/parse (CE06)
 */
async function testCE06() {
  const testName = 'CE06: POST /api/story/parse';
  try {
    const testProjectId = process.env.TEST_PROJECT_ID || 'test-project-id';
    const response = await request('POST', '/api/story/parse', {
      rawText: '这是一个测试小说文本。第一章：开始。',
      projectId: testProjectId,
      novelTitle: '测试小说',
      novelAuthor: '测试作者',
    });

    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.jobId && response.body.traceId) {
        results.push({
          name: testName,
          passed: true,
          evidence: {
            statusCode: response.statusCode,
            body: response.body,
            traceId: response.body.traceId,
            jobId: response.body.jobId,
          },
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        return { success: true, traceId: response.body.traceId, jobId: response.body.jobId };
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Missing jobId or traceId',
          evidence: { statusCode: response.statusCode, body: response.body },
        });
        console.log(`❌ ${testName}: FAILED - Missing jobId or traceId`);
        return { success: false };
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        evidence: { statusCode: response.statusCode, body: response.body },
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return { success: false };
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return { success: false };
  }
}

/**
 * 测试 2: POST /api/text/visual-density (CE03)
 */
async function testCE03() {
  const testName = 'CE03: POST /api/text/visual-density';
  try {
    const testProjectId = process.env.TEST_PROJECT_ID || 'test-project-id';
    const response = await request('POST', '/api/text/visual-density', {
      text: '这是一个测试文本，用于视觉密度分析。',
      projectId: testProjectId,
    });

    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.jobId && response.body.traceId) {
        results.push({
          name: testName,
          passed: true,
          evidence: {
            statusCode: response.statusCode,
            body: response.body,
            traceId: response.body.traceId,
            jobId: response.body.jobId,
          },
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        return { success: true, traceId: response.body.traceId, jobId: response.body.jobId };
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Missing jobId or traceId',
          evidence: { statusCode: response.statusCode, body: response.body },
        });
        console.log(`❌ ${testName}: FAILED - Missing jobId or traceId`);
        return { success: false };
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        evidence: { statusCode: response.statusCode, body: response.body },
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return { success: false };
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return { success: false };
  }
}

/**
 * 测试 3: POST /api/text/enrich (CE04) - Safety Pass
 */
async function testCE04SafetyPass() {
  const testName = 'CE04: POST /api/text/enrich (Safety Pass)';
  try {
    const testProjectId = process.env.TEST_PROJECT_ID || 'test-project-id';
    const response = await request('POST', '/api/text/enrich', {
      text: '这是一个正常的测试文本，用于视觉增强。',
      projectId: testProjectId,
    });

    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.jobId && response.body.traceId && response.body.status !== 'FAILED') {
        results.push({
          name: testName,
          passed: true,
          evidence: {
            statusCode: response.statusCode,
            body: response.body,
            traceId: response.body.traceId,
            jobId: response.body.jobId,
          },
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        console.log(`   status: ${response.body.status}`);
        return { success: true, traceId: response.body.traceId, jobId: response.body.jobId };
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Missing jobId/traceId or status is FAILED',
          evidence: { statusCode: response.statusCode, body: response.body },
        });
        console.log(`❌ ${testName}: FAILED - Missing jobId/traceId or status is FAILED`);
        return { success: false };
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        evidence: { statusCode: response.statusCode, body: response.body },
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return { success: false };
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return { success: false };
  }
}

/**
 * 测试 4: POST /api/text/enrich (CE04) - Safety Fail
 */
async function testCE04SafetyFail() {
  const testName = 'CE04: POST /api/text/enrich (Safety Fail)';
  try {
    const testProjectId = process.env.TEST_PROJECT_ID || 'test-project-id';
    // 使用包含黑名单关键词的文本（根据 TextSafetyService 的黑名单）
    const response = await request('POST', '/api/text/enrich', {
      text: '这是一个包含暴力内容的测试文本。',
      projectId: testProjectId,
    });

    // Safety Fail 应该返回 FAILED 状态
    if (response.statusCode === 202 || response.statusCode === 201) {
      if (response.body.status === 'FAILED' && response.body.reason === 'SAFETY_CHECK_FAILED') {
        results.push({
          name: testName,
          passed: true,
          evidence: {
            statusCode: response.statusCode,
            body: response.body,
            traceId: response.body.traceId,
            jobId: response.body.jobId,
          },
        });
        console.log(`✅ ${testName}: PASSED`);
        console.log(`   jobId: ${response.body.jobId}`);
        console.log(`   traceId: ${response.body.traceId}`);
        console.log(`   status: ${response.body.status}`);
        console.log(`   reason: ${response.body.reason}`);
        console.log(`   safetyFlags: ${response.body.safetyFlags?.join(', ')}`);
        return { success: true, traceId: response.body.traceId, jobId: response.body.jobId };
      } else {
        results.push({
          name: testName,
          passed: false,
          error: 'Expected FAILED status with SAFETY_CHECK_FAILED reason',
          evidence: { statusCode: response.statusCode, body: response.body },
        });
        console.log(`❌ ${testName}: FAILED - Expected FAILED status with SAFETY_CHECK_FAILED reason`);
        return { success: false };
      }
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        evidence: { statusCode: response.statusCode, body: response.body },
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return { success: false };
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return { success: false };
  }
}

/**
 * 测试 5: POST /api/jobs/:id/report (触发质量闭环写入)
 */
async function testJobReport(jobId: string, jobType: string, result: any) {
  const testName = `Job Report: ${jobId} (${jobType})`;
  try {
    const response = await request('POST', `/api/jobs/${jobId}/report`, {
      status: 'SUCCEEDED',
      result,
    });

    if (response.statusCode === 200 || response.statusCode === 201) {
      results.push({
        name: testName,
        passed: true,
        evidence: {
          statusCode: response.statusCode,
          body: response.body,
          jobId,
        },
      });
      console.log(`✅ ${testName}: PASSED`);
      console.log(`   statusCode: ${response.statusCode}`);
      return { success: true, response: response.body };
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Unexpected status code: ${response.statusCode}`,
        evidence: { statusCode: response.statusCode, body: response.body },
      });
      console.log(`❌ ${testName}: FAILED - Status ${response.statusCode}`);
      return { success: false };
    }
  } catch (error: any) {
    results.push({
      name: testName,
      passed: false,
      error: error.message,
    });
    console.log(`❌ ${testName}: FAILED - ${error.message}`);
    return { success: false };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('=== CE Core Commercialization Smoke Test ===\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const ce06Result = await testCE06();
  const ce03Result = await testCE03();
  const ce04PassResult = await testCE04SafetyPass();
  const ce04FailResult = await testCE04SafetyFail();

  console.log('\n=== Quality Metrics Trigger (Job Report) ===');
  
  // 触发质量闭环写入：对 CE03/CE04 的 jobId 调用 report
  if (ce03Result.success && ce03Result.jobId) {
    console.log(`\n📊 Reporting CE03 job ${ce03Result.jobId} as SUCCEEDED...`);
    await testJobReport(ce03Result.jobId, 'CE03_VISUAL_DENSITY', {
      visualDensityScore: 0.85,
    });
  }

  if (ce04PassResult.success && ce04PassResult.jobId) {
    console.log(`\n📊 Reporting CE04 job ${ce04PassResult.jobId} as SUCCEEDED...`);
    await testJobReport(ce04PassResult.jobId, 'CE04_VISUAL_ENRICHMENT', {
      enrichmentQuality: 0.92,
    });
  }

  console.log('\n=== Test Summary ===');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  // 输出证据摘要
  console.log('\n=== Evidence Summary ===');
  results.forEach((r) => {
    if (r.evidence) {
      console.log(`\n${r.name}:`);
      if (r.evidence.traceId) {
        console.log(`  traceId: ${r.evidence.traceId}`);
      }
      if (r.evidence.jobId) {
        console.log(`  jobId: ${r.evidence.jobId}`);
      }
      if (r.evidence.statusCode) {
        console.log(`  statusCode: ${r.evidence.statusCode}`);
      }
    }
  });

  if (passed === total) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { results };

