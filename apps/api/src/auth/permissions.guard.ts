import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from './permissions.decorator';
import { PermissionService } from '../permission/permission.service';

/**
 * PermissionsGuard
 * - 读取 @Permissions 声明的权限
 * - 校验系统级/项目级权限（项目 ID 从路由或 request 中获取）
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionService) private readonly permissionService: PermissionService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;
    if (!user || !user.userId) {
      throw new ForbiddenException('Authentication required (user identity missing)');
    }

    // P0-1 Security: 结构性不可绕过法则。
    // 1. 严格禁止任何基于 authType === 'hmac' 的 return true 直接放行路径。
    // 2. 所有请求必须经过 PermissionService 进行判定。
    // 3. 必须具备 request.user 才能进入hasPermissions。

    // 解析 projectId（从 params/body/query 中尝试获取）
    const projectId =
      request.params?.projectId ||
      request.params?.id || // Studio Fix: Some routes use :id
      request.body?.projectId ||
      request.query?.projectId ||
      undefined;

    const ok = await this.permissionService.hasPermissions({
      userId: user.userId,
      projectId,
      required,
    });

    if (!ok) {
      // Debug: Get actual perms to show why it failed
      const sysPerms = await this.permissionService.getUserPermissions(user.userId);
      const projPerms = projectId ? await this.permissionService.getProjectPermissions(projectId, user.userId) : [];
      throw new ForbiddenException(`Permission denied. Required: [${required.join(', ')}]. Has: Sys=[${sysPerms.join(',')}], Proj=[${projPerms.join(',')}]`);
    }
    return true;
  }
}

