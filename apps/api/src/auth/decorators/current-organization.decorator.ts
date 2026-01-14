import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 获取当前请求的组织 ID
 * 从 JWT payload 中提取（在 JwtStrategy 中设置）
 */
export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();

    // P0-SEC: 优先支持从请求头获取（支持多组织切换），Express .get() 自动处理大小写
    const orgIdFromHeader = typeof request.get === 'function' ? request.get('x-organization-id') : request.headers['x-organization-id'];
    if (orgIdFromHeader) return orgIdFromHeader as string;

    // 从 JWT payload 中获取（在 JwtStrategy 中设置）
    return request.user?.organizationId || request.apiKeyOwnerOrgId || null;
  }
);
