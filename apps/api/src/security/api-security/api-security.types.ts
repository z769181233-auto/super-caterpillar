/**
 * API Security Types
 * 
 * 定义 API 安全相关的类型定义
 */

/**
 * HMAC 签名验证结果
 */
export interface SignatureVerificationResult {
  success: boolean;
  apiKeyId?: string;
  apiKey?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 签名验证上下文
 */
export interface SignatureVerificationContext {
  apiKey: string;
  nonce: string;
  timestamp: string;
  signature: string;
  method: string;
  path: string; // v2: 包含 query string 的完整路径
  contentSha256: string; // v2: 内容 SHA256 哈希（hex）或 'UNSIGNED'
  body?: string; // v1 兼容（可选）
  ip?: string;
  userAgent?: string;
}

/**
 * 审计日志详情（签名相关）
 */
export interface SignatureAuditDetails {
  nonce: string;
  signature: string;
  timestamp: string;
  path: string;
  method: string;
  apiKey?: string; // 可脱敏
  reason?: string; // 失败原因码
  errorCode?: string;
}

