import { Injectable, Logger, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 存储权限验证服务
 * 验证用户是否有权限访问指定的存储资源
 */
@Injectable()
export class StorageAuthService {
  private readonly logger = new Logger(StorageAuthService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService
  ) {
    if (!this.prisma) {
      this.logger.error('CRITICAL: PrismaService injected as undefined! Check for circular dependencies.');
    } else {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] StorageAuthService init. Prisma is defined via ' + this.prisma.constructor.name);
    }
  }

  /**
   * 验证用户是否有权限访问存储 key
   * @param key 存储 key
   * @param tenantId 租户 ID
   * @param userId 用户 ID
   * @returns 如果无权限，抛出异常；如果有权限，返回 true
   */
  async verifyAccess(key: string, tenantId: string, userId: string): Promise<boolean> {
    console.log('[StorageAuth] verify', { key, tenantId, userId });

    // 0. System-level audit bypass (bound by signature verification in controller)
    if (userId === 'system-audit-viewer') {
      console.log('[StorageAuth] Access granted for system-audit-viewer');
      return true;
    }

    // P0 Fix: SSOT - Query by storageKey first (primary)
    const asset = await this.prisma.asset.findFirst({
      where: { storageKey: key },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            organizationId: true,
            ownerId: true,
          },
        },
      },
    });

    // 2. If no Asset found by storageKey, return 404
    if (!asset) {
      this.logger.debug(`[StorageAuth] Asset not found for key: ${key}`);
      this.logger.warn(`[StorageAuth] Asset not found for key: ${key}, tenantId: ${tenantId}, userId: ${userId}`);
      throw new NotFoundException('Resource not found');
    }

    console.log('[StorageAuth] asset-found', { assetId: asset.id, projectId: asset.projectId, orgId: asset.project?.organizationId });

    // 3. Validate tenant (projectId or organizationId)
    const organizationId = asset.project?.organizationId;

    // Commercial-grade: allow tenant matching by projectId OR organizationId
    const tenantMatches = (
      asset.projectId === tenantId ||
      organizationId === tenantId ||
      tenantId.startsWith('proj_') && asset.projectId === tenantId
    );

    if (!tenantMatches) {
      this.logger.warn(
        `[StorageAuth] Tenant mismatch: key=${key}, expected=${tenantId}, asset.projectId=${asset.projectId}, asset.orgId=${organizationId}`,
      );
      // P0 Fix: In dev, allow mismatch with warning; in prod, enforce strict
      if (process.env.NODE_ENV === 'production') {
        throw new NotFoundException('Resource not found'); // 404 to prevent enumeration
      } else {
        console.warn('[StorageAuth] WARN_TENANT_MISMATCH: allowing in dev mode');
      }
    }

    // 4. Verify user has access (organization member or project owner)
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      const isOwner = asset.project?.ownerId === userId;
      if (!isOwner) {
        this.logger.warn(
          `[StorageAuth] User ${userId} has no access to key ${key} in tenant ${tenantId}`,
        );
        throw new NotFoundException('Resource not found'); // 404 to prevent enumeration
      }
    }

    console.log('[StorageAuth] access-granted', { key, tenantId, userId });
    return true;
  }

  /**
   * P2 修复：统一的 storage key 校验函数（单点）
   * 确保所有入口使用相同的校验规则
   */
  private assertValidStorageKey(key: string): void {
    if (!key) {
      throw new Error('Invalid storage key');
    }
    if (key.includes('..') || key.startsWith('/') || key.includes('\0')) {
      throw new Error('Invalid storage key');
    }
  }

  /**
   * 获取存储 key 的完整路径（用于 Nginx X-Accel-Redirect）
   * P2 修复：使用统一的校验函数
   */
  getStoragePath(key: string): string {
    // 使用统一的校验函数
    this.assertValidStorageKey(key);

    // 返回相对于存储根目录的路径
    // Nginx 配置中会映射到实际文件系统路径
    return `/protected_storage/${key}`;
  }
}

