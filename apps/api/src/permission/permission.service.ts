import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCache } from './permission.cache';
import {
  SystemPermission,
  ProjectPermission,
  SystemPermissions,
  ProjectPermissions,
} from './permission.constants';

@Injectable()
export class PermissionService {
    private readonly logger = new Logger(PermissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCache
  ) {
    // 临时日志：确认构造成功
    this.logger.log('[PermissionService] 构造成功，PrismaService 已注入');
  }

  // 获取系统级权限
  async getUserPermissions(userId: string, contextOrgId?: string): Promise<string[]> {
    const cacheKey = contextOrgId ? `${userId}:${contextOrgId}` : userId;
    const cached = await this.cache.getUserPerms(cacheKey);
    if (cached) return cached;

    // 1. 获取基础 User 信息
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    // 2. 收集角色候选集 (RBAC)
    const roleNames = new Set<string>();

    // a) 系统默认角色 (User.role)
    // ABAC FIX: 当指定了 orgId 时，严格禁用全局 user.role，杜绝权限侧漏
    if (user.role && !contextOrgId) {
      roleNames.add(user.role);
    }

    // b) 组织成员角色 (OrganizationMember.role)
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        ...(contextOrgId ? { organizationId: contextOrgId } : {}),
      },
    });

    memberships.forEach((m) => roleNames.add(m.role));

    // 3. 从数据库查询权限表 (Strict RBAC)
    const rolePerms = await this.prisma.rolePermission
      .findMany({
        where: {
          role: { name: { in: Array.from(roleNames) } },
        },
        include: { permission: true },
      })
      .catch(() => []);

    const perms = Array.from(new Set(rolePerms.map((rp: any) => rp.permission.key))) as string[];

    await this.cache.setUserPerms(cacheKey, perms);
    return perms;
  }

  // 获取项目级权限
  async getProjectPermissions(projectId: string, userId: string): Promise<string[]> {
    const cached = await this.cache.getProjectPerms(projectId, userId);
    if (cached) return cached;

    // ABAC: 授权必须基于项目成员关系
    const projectMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      include: { role: { include: { rolePerms: { include: { permission: true } } } } },
    });

    let perms: string[] = [];

    // a) 通过 ProjectMember 获得的权限 (取消所有 scope==='project' 等物理过滤，返回全量)
    if (projectMember) {
      perms = projectMember.role.rolePerms.map((rp: any) => rp.permission.key);
    }

    await this.cache.setProjectPerms(projectId, userId, perms);
    return perms;
  }

  // 判定是否具备指定权限（系统或项目）
  async hasPermissions(params: {
    userId: string;
    projectId?: string;
    required: Array<SystemPermission | ProjectPermission>;
  }): Promise<boolean> {
    const { userId, projectId, required } = params;

    // 1. 定位上下文 OrganizationId (ABAC 锚点)
    let orgId: string | undefined;
    if (projectId) {
      const proj = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      orgId = proj?.organizationId || undefined;
    }

    // DIAGNOSIS START
    if (process.env.DEBUG_PERM === '1' || process.env.NODE_ENV !== 'production') {
      const dbgMem = await this.prisma.organizationMember.findMany({
        where: { userId, ...(orgId ? { organizationId: orgId } : {}) },
      });
      this.logger.log(`[PERM_DIAG] User=${userId} ContextOrg=${orgId || 'N/A'}`);
      this.logger.log(`[PERM_DIAG] Memberships=${dbgMem.length} (${dbgMem.map((m) => m.organizationId + ':' + m.role).join(',')})`);
    }
    // DIAGNOSIS END

    // 2. 获取权限全集 (无硬编码 bypass，除非是系统管理员级别)
    const sysPerms = await this.getUserPermissions(userId, orgId);
    const projPerms = projectId ? await this.getProjectPermissions(projectId, userId) : [];

    const allPerms = new Set([...sysPerms, ...projPerms]);

    // DIAGNOSIS START
    if (process.env.DEBUG_PERM === '1' || process.env.NODE_ENV !== 'production') {
      this.logger.log(`[PERM_DIAG] SysPerms=${sysPerms.length} ProjPerms=${projPerms.length} Total=${allPerms.size}`);
      if (allPerms.size === 0) {
        this.logger.warn(`[PERM_DIAG] ZERO PERMISSIONS! checking reasons...`);
        // Check if roles exist
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        this.logger.log(`[PERM_DIAG] UserRole=${user?.role} UserType=${user?.userType}`);
      }
    }
    // DIAGNOSIS END

    // 3. 检查是否满足所有要求 (RBAC Check)
    const isGranted = required.every((p) => allPerms.has(p));

    if (!isGranted) {
      this.logger.warn(`[PERM_DENIED] userId=${userId} context=${projectId || orgId || 'NONE'} missing=[${required.filter((p) => !allPerms.has(p)).join(',')}]`);
    }

    return isGranted;
  }

  /**
   * 断言用户可以管理项目（最小可用实现）
   */
  async assertCanManageProject(userId: string, organizationId: string): Promise<void> {
    const hasAuth = await this.hasPermissions({
      userId,
      required: [SystemPermissions.AUTH],
    });
    if (!hasAuth) {
      // DEBUG: Expose role info in error to diagnose 403
      const perms = await this.getUserPermissions(userId);
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const role = user?.role;
      throw new ForbiddenException(
        `NO_PERMISSION_MANAGE_PROJECT (Debug: user=${userId} role=${role} perms=${perms.join(',')})`
      );
    }
  }

  /**
   * 断言用户可以管理 Job（最小可用实现）
   */
  async assertCanManageJobs(userId: string, organizationId: string): Promise<void> {
    const hasAuth = await this.hasPermissions({
      userId,
      required: [SystemPermissions.AUTH],
    });
    if (!hasAuth) {
      throw new ForbiddenException('NO_PERMISSION_MANAGE_JOB');
    }
  }
}
