/**
 * S3-A.1 验证脚本
 * 用于验证 HTTP 引擎配置与安全设计的实现
 *
 * 运行方式：ts-node apps/api/scripts/verify-s3a1.ts
 */

import { EngineConfigService } from '../src/config/engine.config';
import { HttpEngineAdapter } from '../src/engine/adapters/http-engine.adapter';
import { EngineInvokeInput, EngineInvokeStatus } from '@scu/shared-types';
import * as util from "util";

// 模拟 Logger
class MockLogger {
  logs: any[] = [];
  log(message: any) {
    this.logs.push({ level: 'log', message });
    process.stdout.write(util.format('[LOG]', typeof message === 'string' ? message : JSON.stringify(message, null, 2)) + "\n");
  }
  warn(message: any) {
    this.logs.push({ level: 'warn', message });
    process.stdout.write(util.format('[WARN]', typeof message === 'string' ? message : JSON.stringify(message, null, 2)) + "\n");
  }
  error(message: any) {
    this.logs.push({ level: 'error', message });
    process.stderr.write(util.format('[ERROR]', typeof message === 'string' ? message : JSON.stringify(message, null, 2)) + "\n");
  }
}

/**
 * 环境变量快照和恢复工具
 */
class EnvSnapshot {
  private snapshot: Record<string, string | undefined> = {};

  /**
   * 创建环境变量快照（浅拷贝）
   */
  capture(): void {
    this.snapshot = { ...process.env };
  }

  /**
   * 恢复环境变量到快照状态
   */
  restore(): void {
    // 清除所有 HTTP_ENGINE_* 和 ENGINE_HTTP_* 变量
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('HTTP_ENGINE_') || key.startsWith('ENGINE_HTTP_')) {
        delete process.env[key];
      }
    });

    // 恢复快照中的值
    Object.keys(this.snapshot).forEach((key) => {
      if (key.startsWith('HTTP_ENGINE_') || key.startsWith('ENGINE_HTTP_')) {
        const value = this.snapshot[key];
        if (value !== undefined) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      }
    });
  }

  /**
   * 清除所有 HTTP_ENGINE_* 和 ENGINE_HTTP_* 环境变量
   */
  clearHttpEngineVars(): void {
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('HTTP_ENGINE_') || key.startsWith('ENGINE_HTTP_')) {
        delete process.env[key];
      }
    });
  }

  /**
   * 设置环境变量（仅 HTTP_ENGINE_* 相关）
   */
  setHttpEngineVar(key: string, value: string): void {
    process.env[key] = value;
  }

  /**
   * 删除环境变量
   */
  deleteHttpEngineVar(key: string): void {
    delete process.env[key];
  }
}

async function main() {
  // ============================================
  // 环境变量快照（脚本入口处）
  // ============================================
  const envSnapshot = new EnvSnapshot();
  envSnapshot.capture();

  // 确保脚本退出前恢复环境变量
  const cleanup = () => {
    envSnapshot.restore();
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(1);
  });

  process.stdout.write(util.format('='.repeat(80)) + "\n");
  process.stdout.write(util.format('S3-A.1 HTTP 引擎配置与安全设计 - 验证脚本') + "\n");
  process.stdout.write(util.format('='.repeat(80)) + "\n");
  process.stdout.write(util.format('') + "\n");

  // ============================================
  // 【1】配置读取验证
  // ============================================
  process.stdout.write(util.format('【1】配置读取验证') + "\n");
  process.stdout.write(util.format('-'.repeat(80)) + "\n");

  // 读取 engines.json
  const fs = require('fs');
  const path = require('path');
  const enginesJsonPath = path.join(__dirname, '..', 'config', 'engines.json');
  let enginesJsonContent = '{}';
  try {
    enginesJsonContent = fs.readFileSync(enginesJsonPath, 'utf-8');
    const enginesJson = JSON.parse(enginesJsonContent);
    process.stdout.write(util.format('✓ engines.json 内容（脱敏）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(enginesJson, null, 2)) + "\n");
  } catch (error) {
    process.stdout.write(util.format('⚠ engines.json 读取失败:', error) + "\n");
  }
  process.stdout.write(util.format('') + "\n");

  // 场景 a: 只配置全局环境变量
  process.stdout.write(util.format('场景 a: 只配置全局环境变量') + "\n");
  envSnapshot.clearHttpEngineVars(); // 清除所有 HTTP_ENGINE_* 变量
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_BASE_URL', 'https://global.example.com');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_API_KEY', 'global-api-key-12345');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_TIMEOUT_MS', '45000');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_PATH', '/global/invoke');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_AUTH_MODE', 'bearer');
  // 确保清除引擎级变量
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_GEMINI_V1_BASE_URL');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_GEMINI_V1_API_KEY');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_GEMINI_V1_TIMEOUT_MS');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_GEMINI_V1_PATH');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_GEMINI_V1_AUTH_MODE');

  const serviceA = new EngineConfigService();
  serviceA.clearCache(); // 清除缓存
  try {
    const configA = serviceA.getHttpEngineConfig('http_gemini_v1');
    process.stdout.write(util.format('✓ 配置结果（场景 a）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(
              {
                baseUrl: configA.baseUrl,
                timeoutMs: configA.timeoutMs,
                path: configA.path,
                authMode: configA.authMode,
                hasApiKey: !!configA.apiKey,
                apiKeyLength: configA.apiKey?.length,
              },
              null,
              2
            )) + "\n");
  } catch (error) {
    process.stdout.write(util.format('✗ 配置读取失败:', error) + "\n");
  }
  // 场景 a 结束，恢复环境变量
  envSnapshot.restore();
  process.stdout.write(util.format('') + "\n");

  // 场景 b: 只配置引擎级环境变量（清除全局变量）
  process.stdout.write(util.format('场景 b: 只配置引擎级环境变量（清除全局变量）') + "\n");
  envSnapshot.clearHttpEngineVars(); // 清除所有 HTTP_ENGINE_* 变量
  // 设置引擎级变量
  envSnapshot.setHttpEngineVar(
    'HTTP_ENGINE_GEMINI_V1_BASE_URL',
    'https://gemini-specific.example.com'
  );
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_GEMINI_V1_API_KEY', 'gemini-specific-key-67890');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_GEMINI_V1_TIMEOUT_MS', '60000');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_GEMINI_V1_PATH', '/gemini/invoke');
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_GEMINI_V1_AUTH_MODE', 'bearer');
  // 确保清除全局变量
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_BASE_URL');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_API_KEY');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_TIMEOUT_MS');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_PATH');
  envSnapshot.deleteHttpEngineVar('HTTP_ENGINE_AUTH_MODE');

  const serviceB = new EngineConfigService();
  serviceB.clearCache();
  try {
    const configB = serviceB.getHttpEngineConfig('http_gemini_v1');
    process.stdout.write(util.format('✓ 配置结果（场景 b）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(
              {
                baseUrl: configB.baseUrl,
                timeoutMs: configB.timeoutMs,
                path: configB.path,
                authMode: configB.authMode,
                hasApiKey: !!configB.apiKey,
                apiKeyLength: configB.apiKey?.length,
              },
              null,
              2
            )) + "\n");
    const match = configB.baseUrl === 'https://gemini-specific.example.com';
    process.stdout.write(util.format(match
              ? '✓ 符合预期：baseUrl 是引擎级配置'
              : `✗ 不符合预期：baseUrl 应该是 https://gemini-specific.example.com，实际是 ${configB.baseUrl}`) + "\n");
  } catch (error) {
    process.stdout.write(util.format('✗ 配置读取失败:', error instanceof Error ? error.message : String(error)) + "\n");
  }
  // 场景 b 结束，恢复环境变量
  envSnapshot.restore();
  process.stdout.write(util.format('') + "\n");

  // 场景 c: 只配置 JSON（不配 env，但需要 authMode=none 或提供 API Key）
  process.stdout.write(util.format('场景 c: 只配置 JSON（不配 env，使用 authMode=none）') + "\n");
  envSnapshot.clearHttpEngineVars(); // 清除所有 HTTP_ENGINE_* 环境变量

  const serviceC = new EngineConfigService();
  serviceC.clearCache();
  try {
    // 使用 http_local_llm（authMode=none，不需要 API Key）
    const configC = serviceC.getHttpEngineConfig('http_local_llm');
    process.stdout.write(util.format('✓ 配置结果（场景 c，使用 http_local_llm）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(
              {
                baseUrl: configC.baseUrl,
                timeoutMs: configC.timeoutMs,
                path: configC.path,
                authMode: configC.authMode,
                hasApiKey: !!configC.apiKey,
              },
              null,
              2
            )) + "\n");
    const match = configC.baseUrl === 'http://localhost:11434';
    process.stdout.write(util.format(match
              ? '✓ 符合预期：baseUrl 来自 JSON 配置'
              : '✗ 不符合预期：baseUrl 应该是 http://localhost:11434') + "\n");
  } catch (error) {
    process.stdout.write(util.format('✗ 配置读取失败:', error) + "\n");
  }
  // 场景 c 结束，恢复环境变量
  envSnapshot.restore();
  process.stdout.write(util.format('') + "\n");

  // ============================================
  // 【2】认证头拼装验证
  // ============================================
  process.stdout.write(util.format('【2】认证头拼装验证') + "\n");
  process.stdout.write(util.format('-'.repeat(80)) + "\n");

  const adapter = new HttpEngineAdapter(new EngineConfigService());
  const mockLogger = new MockLogger();
  (adapter as any).logger = mockLogger;

  // 场景 a: authMode='bearer'
  process.stdout.write(util.format('场景 a: authMode="bearer"') + "\n");
  const configBearer = {
    baseUrl: 'https://example.com',
    timeoutMs: 30000,
    path: '/invoke',
    authMode: 'bearer' as const,
    apiKey: 'test-api-key-1234567890',
  };
  try {
    const headersBearer = (adapter as any).buildAuthHeaders(configBearer, { test: 'data' });
    process.stdout.write(util.format('✓ Bearer 认证 Headers（只显示键名）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(Object.keys(headersBearer), null, 2)) + "\n");
    process.stdout.write(util.format('预期：只有 Authorization header') + "\n");
  } catch (error) {
    process.stdout.write(util.format('✗ Bearer 认证失败:', error) + "\n");
  }
  process.stdout.write(util.format('') + "\n");

  // 场景 b: authMode='apiKey'
  process.stdout.write(util.format('场景 b: authMode="apiKey"') + "\n");
  const configApiKey = {
    baseUrl: 'https://example.com',
    timeoutMs: 30000,
    path: '/invoke',
    authMode: 'apiKey' as const,
    apiKey: 'test-api-key-1234567890',
    apiKeyHeader: 'X-Custom-API-Key',
  };
  try {
    const headersApiKey = (adapter as any).buildAuthHeaders(configApiKey, { test: 'data' });
    process.stdout.write(util.format('✓ API Key 认证 Headers（只显示键名）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(Object.keys(headersApiKey), null, 2)) + "\n");
    process.stdout.write(util.format('预期：只有 X-Custom-API-Key header') + "\n");
  } catch (error) {
    process.stdout.write(util.format('✗ API Key 认证失败:', error) + "\n");
  }
  process.stdout.write(util.format('') + "\n");

  // 场景 c: authMode='none'
  process.stdout.write(util.format('场景 c: authMode="none"') + "\n");
  const configNone = {
    baseUrl: 'https://example.com',
    timeoutMs: 30000,
    path: '/invoke',
    authMode: 'none' as const,
  };
  try {
    const headersNone = (adapter as any).buildAuthHeaders(configNone, { test: 'data' });
    process.stdout.write(util.format('✓ None 认证 Headers（只显示键名）：') + "\n");
    process.stdout.write(util.format(JSON.stringify(Object.keys(headersNone), null, 2)) + "\n");
    process.stdout.write(util.format('预期：空的 headers 对象') + "\n");
  } catch (error) {
    process.stdout.write(util.format('✗ None 认证失败:', error) + "\n");
  }
  process.stdout.write(util.format('') + "\n");

  // ============================================
  // 【3】错误分类验证
  // ============================================
  process.stdout.write(util.format('【3】错误分类验证') + "\n");
  process.stdout.write(util.format('-'.repeat(80)) + "\n");

  const testCases = [
    {
      name: 'HTTP 200 + success=true',
      response: { status: 200, data: { success: true, data: { result: 'ok' } }, headers: {} },
      expectedStatus: EngineInvokeStatus.SUCCESS,
      expectedErrorType: null,
    },
    {
      name: 'HTTP 200 + success=false',
      response: {
        status: 200,
        data: { success: false, error: { message: 'Business error' } },
        headers: {},
      },
      expectedStatus: EngineInvokeStatus.FAILED,
      expectedErrorType: 'BUSINESS_ERROR',
    },
    {
      name: 'HTTP 500',
      response: { status: 500, data: {}, headers: {} },
      expectedStatus: EngineInvokeStatus.RETRYABLE,
      expectedErrorType: 'HTTP_5XX',
    },
    {
      name: 'HTTP 429',
      response: { status: 429, data: {}, headers: { 'retry-after': '60' } },
      expectedStatus: EngineInvokeStatus.RETRYABLE,
      expectedErrorType: 'HTTP_429',
    },
    {
      name: 'HTTP 400',
      response: { status: 400, data: {}, headers: {} },
      expectedStatus: EngineInvokeStatus.FAILED,
      expectedErrorType: 'HTTP_4XX',
    },
  ];

  for (const testCase of testCases) {
    process.stdout.write(util.format(`测试: ${testCase.name}`) + "\n");
    try {
      const result = (adapter as any).handleHttpResponse(
        testCase.response,
        'http_test',
        'TEST_JOB',
        1000
      );
      const actualStatus = result.status;
      const actualErrorType = result.error?.details?.errorType || null;
      const match =
        actualStatus === testCase.expectedStatus && actualErrorType === testCase.expectedErrorType;
      process.stdout.write(util.format(match ? '✓' : '✗', `输入: ${testCase.name}`, `→ 输出: status=${actualStatus}, errorType=${actualErrorType}`, match
                  ? '(符合预期)'
                  : `(预期: status=${testCase.expectedStatus}, errorType=${testCase.expectedErrorType})`) + "\n");
    } catch (error) {
      process.stdout.write(util.format('✗ 测试失败:', error) + "\n");
    }
  }
  process.stdout.write(util.format('') + "\n");

  // 网络错误测试
  process.stdout.write(util.format('网络错误测试:') + "\n");
  const networkErrorCases = [
    {
      code: 'ECONNRESET',
      expectedStatus: EngineInvokeStatus.RETRYABLE,
      expectedErrorType: 'NETWORK_ERROR',
    },
    {
      code: 'ETIMEDOUT',
      expectedStatus: EngineInvokeStatus.RETRYABLE,
      expectedErrorType: 'NETWORK_ERROR',
    },
    {
      code: 'ENETUNREACH',
      expectedStatus: EngineInvokeStatus.RETRYABLE,
      expectedErrorType: 'NETWORK_ERROR',
    },
  ];

  for (const testCase of networkErrorCases) {
    process.stdout.write(util.format(`测试: error.code=${testCase.code}`) + "\n");
    try {
      const error = { type: 'NETWORK_ERROR', code: testCase.code, message: 'Network error' };
      const result = (adapter as any).handleHttpError(error, 'http_test', 'TEST_JOB', 1000);
      const actualStatus = result.status;
      const actualErrorType = result.error?.details?.errorType || null;
      const match =
        actualStatus === testCase.expectedStatus && actualErrorType === testCase.expectedErrorType;
      process.stdout.write(util.format(match ? '✓' : '✗', `输入: error.code=${testCase.code}`, `→ 输出: status=${actualStatus}, errorType=${actualErrorType}`, match
                  ? '(符合预期)'
                  : `(预期: status=${testCase.expectedStatus}, errorType=${testCase.expectedErrorType})`) + "\n");
    } catch (error) {
      process.stdout.write(util.format('✗ 测试失败:', error) + "\n");
    }
  }
  process.stdout.write(util.format('') + "\n");

  // ============================================
  // 【4】日志脱敏验证
  // ============================================
  process.stdout.write(util.format('【4】日志脱敏验证') + "\n");
  process.stdout.write(util.format('-'.repeat(80)) + "\n");

  const configWithApiKey = {
    baseUrl: 'https://example.com',
    timeoutMs: 30000,
    path: '/invoke',
    authMode: 'bearer' as const,
    apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz',
  };

  mockLogger.logs = [];
  (adapter as any).logRequestStart(
    'http_test',
    'TEST_JOB',
    'https://example.com/invoke',
    configWithApiKey,
    {},
    {}
  );

  const logEntry = mockLogger.logs.find(
    (l) =>
      l.message && typeof l.message === 'string' && l.message.includes('HTTP_ENGINE_INVOKE_START')
  );
  if (logEntry) {
    try {
      const logData = JSON.parse(logEntry.message);
      process.stdout.write(util.format('✓ 日志内容（脱敏检查）：') + "\n");
      process.stdout.write(util.format(JSON.stringify(
                  {
                    hasApiKey: logData.hasApiKey,
                    apiKeyPrefix: logData.apiKeyPrefix,
                    apiKeySuffix: logData.apiKeySuffix,
                    apiKeyLength: logData.apiKeyLength,
                    hasFullApiKey: logData.apiKey !== undefined,
                  },
                  null,
                  2
                )) + "\n");
      process.stdout.write(util.format('预期：hasFullApiKey=false（不包含完整 API Key）') + "\n");
    } catch (error) {
      process.stdout.write(util.format('⚠ 日志解析失败:', error) + "\n");
    }
  } else {
    process.stdout.write(util.format('⚠ 未找到 HTTP_ENGINE_INVOKE_START 日志') + "\n");
  }
  process.stdout.write(util.format('') + "\n");

  // ============================================
  // 【5】边界与失败配置验证
  // ============================================
  process.stdout.write(util.format('【5】边界与失败配置验证') + "\n");
  process.stdout.write(util.format('-'.repeat(80)) + "\n");

  // 测试非法 baseUrl
  process.stdout.write(util.format('测试: 非法 baseUrl') + "\n");
  envSnapshot.clearHttpEngineVars(); // 清除所有 HTTP_ENGINE_* 变量
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_BASE_URL', 'not-a-url');
  const serviceInvalid = new EngineConfigService();
  serviceInvalid.clearCache();
  try {
    const configInvalid = serviceInvalid.getHttpEngineConfig('http_test');
    process.stdout.write(util.format('✗ 应该抛出错误，但配置读取成功:', configInvalid.baseUrl) + "\n");
  } catch (error) {
    process.stdout.write(util.format('✓ 正确抛出错误:', error instanceof Error ? error.message : String(error)) + "\n");
  }
  envSnapshot.restore(); // 恢复环境变量
  process.stdout.write(util.format('') + "\n");

  // 测试负数 timeoutMs
  process.stdout.write(util.format('测试: 负数 timeoutMs') + "\n");
  envSnapshot.clearHttpEngineVars(); // 清除所有 HTTP_ENGINE_* 变量
  envSnapshot.setHttpEngineVar('HTTP_ENGINE_TIMEOUT_MS', '-1000');
  const serviceNegative = new EngineConfigService();
  serviceNegative.clearCache();
  try {
    const configNegative = serviceNegative.getHttpEngineConfig('http_test');
    process.stdout.write(util.format('✗ 应该抛出错误或使用默认值，但配置读取成功:', configNegative.timeoutMs) + "\n");
  } catch (error) {
    process.stdout.write(util.format('✓ 正确抛出错误:', error instanceof Error ? error.message : String(error)) + "\n");
  }
  envSnapshot.restore(); // 恢复环境变量
  process.stdout.write(util.format('') + "\n");

  // 测试空 baseUrl（需要确保没有 fallback）
  process.stdout.write(util.format('测试: 空 baseUrl（无 fallback）') + "\n");
  envSnapshot.clearHttpEngineVars(); // 清除所有 HTTP_ENGINE_* 变量
  const serviceEmpty = new EngineConfigService();
  serviceEmpty.clearCache();
  // 设置空值（但实际会被跳过，因为空字符串会被 || 短路）
  // 我们需要测试一个场景：JSON 中也没有 baseUrl，且 env 也没有
  // 但实际代码中有 fallback 到 env.engineRealHttpBaseUrl 或 'http://localhost:8000'
  // 所以这个测试需要特殊处理：直接测试 validateHttpEngineConfig
  try {
    // 直接调用验证函数测试空 baseUrl
    (serviceEmpty as any).validateHttpEngineConfig(
      '',
      30000,
      '/invoke',
      'none',
      undefined,
      undefined
    );
    process.stdout.write(util.format('✗ 应该抛出错误，但验证通过') + "\n");
  } catch (error) {
    process.stdout.write(util.format('✓ 正确抛出错误:', error instanceof Error ? error.message : String(error)) + "\n");
  }
  envSnapshot.restore(); // 恢复环境变量
  process.stdout.write(util.format('') + "\n");

  // ============================================
  // 最终环境变量恢复（脚本退出前）
  // ============================================
  envSnapshot.restore();
  process.stdout.write(util.format('='.repeat(80)) + "\n");
  process.stdout.write(util.format('验证完成') + "\n");
  process.stdout.write(util.format('='.repeat(80)) + "\n");
  process.stdout.write(util.format('✓ 环境变量已恢复到初始状态') + "\n");
}

main().catch((error) => {
  process.stderr.write(util.format('验证脚本执行失败:', error) + "\n");
  process.exit(1);
});
