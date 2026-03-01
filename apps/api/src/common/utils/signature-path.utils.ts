/**
 * 签名路径判断工具
 * 依据 SafetySpec / API Spec：敏感/高成本接口必须签名
 * 白名单免签：/api/auth/**、/api/health、/api/public/**
 * 其余默认要签（或至少把"GPU/任务/引擎/worker"相关路径加入必签列表）
 */

const SIGN_EXEMPT_PREFIX = [
  '/api/auth',
  '/api/health',
  '/api/public',
  '/health',
  '/metrics',
  '/ping',
  '/',
];

// 内部接口（仅 HMAC，不需要 JWT）
const INTERNAL_HMAC_ONLY_PREFIX = ['/api/_internal'];

/**
 * 判断路径是否应该绕过签名校验
 */
export function shouldBypassSignature(pathname: string): boolean {
  const path = (pathname || '').split('?')[0]; // 去掉 query string
  return SIGN_EXEMPT_PREFIX.some((p) => path.startsWith(p));
}

/**
 * 判断路径是否要求签名校验
 */
export function shouldRequireSignature(pathname: string): boolean {
  return !shouldBypassSignature(pathname);
}
