/**
 * 引擎母版 - Real 实现
 *
 * 真实引擎逻辑：调用外部 API / GPU / 模型服务
 *
 * 必须输出:
 * - billing_usage: 计费使用量
 * - audit_trail: 审计追踪
 */

import * as crypto from 'crypto';
import { __ENGINE__Input, __ENGINE__Output, EngineBillingUsage, EngineAuditTrail } from './types';

/**
 * 真实引擎实现
 */
export async function __ENGINE__RealEngine(input: __ENGINE__Input): Promise<__ENGINE__Output> {
  const startTime = Date.now();

  // 1. 计算输入参数哈希（用于幂等性）
  const paramsHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

  // 2. 执行真实业务逻辑
  // TEMPLATE_REQUIRED:
  // 复制此母版到具体引擎后，必须在这里替换成真实业务调用。
  // 示例:
  // const result = await callExternalAPI(input);
  // const asset = await generateAsset(input);

  const duration = Date.now() - startTime;

  // 3. 构建计费使用量（必须）
  const billing_usage: EngineBillingUsage = {
    promptTokens: 0, // TEMPLATE_DEFAULT: 具体引擎应填入真实 token 使用量
    completionTokens: 0, // TEMPLATE_DEFAULT: 具体引擎应填入真实 token 使用量
    totalTokens: 0, // TEMPLATE_DEFAULT: 具体引擎应填入真实 token 使用量
    model: '__ENGINE__-real',
    gpuSeconds: duration / 1000,
  };

  // 4. 构建审计追踪（必须）
  const audit_trail: EngineAuditTrail = {
    engineKey: '__ENGINE__',
    engineVersion: '1.0.0-real',
    timestamp: new Date().toISOString(),
    paramsHash,
    traceId: input.traceId,
  };

  // 5. 返回结果
  return {
    // TEMPLATE_REQUIRED: 在具体引擎中添加真实业务输出字段
    // result: { ... },
    // asset: { uri: '...', sha256: '...' },

    billing_usage,
    audit_trail,
  };
}
