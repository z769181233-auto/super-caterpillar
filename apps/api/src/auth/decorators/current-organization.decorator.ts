import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 获取当前请求的组织 ID
 * 从 JWT payload 中提取（在 JwtStrategy 中设置）
 */
export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    // 从 JWT payload 中获取（在 JwtStrategy 中设置）
    return request.user?.organizationId || null;
  }
);











