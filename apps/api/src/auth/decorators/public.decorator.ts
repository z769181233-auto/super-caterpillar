import { SetMetadata } from '@nestjs/common';

/**
 * @Public() 装饰器
 * 用于标记无需 HMAC 校验的公开路由（如 login、register、health check 等）
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
