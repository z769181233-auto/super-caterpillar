import { HttpException } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * 构造符合 API Spec 的 HMAC 错误响应
 * - code=4003：签名缺失/签名不合法/时间戳非法/缺少头
 * - code=4004：Nonce 重放拒绝
 */
export function buildHmacError(
  code: '4003' | '4004',
  message: string,
  debug?: { path?: string; method?: string }
): HttpException {
  const body = {
    success: false,
    error: { code, message },
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
    path: debug?.path,
    method: debug?.method,
  };
  // HTTP status 保持 401/403（不强制），但 body 必须包含 { code, message }
  const status = code === '4003' ? 401 : 403;
  return new HttpException(body, status);
}
