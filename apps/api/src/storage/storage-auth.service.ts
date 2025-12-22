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
    // P0 修复：优化查询，避免 N+1 问题
    // 只查询必要的字段，避免深度嵌套 include
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

    // 2. 如果找不到 Asset，统一返回 404（防枚举）
    if (!asset) {
      this.logger.debug(`[StorageAuth] Asset not found for key: ${key}`);
      this.logger.warn(`[StorageAuth] Asset not found for key: ${key}, tenantId: ${tenantId}, userId: ${userId}`);
      throw new NotFoundException('Resource not found');
    }

    // 3. 验证租户权限
    const organizationId = asset.project.organizationId;
    if (organizationId !== tenantId) {
      this.logger.debug(`[StorageAuth] Tenant mismatch: key=${key} expected=${tenantId} actual=${organizationId}`);
      this.logger.warn(
        `[StorageAuth] Tenant mismatch: key=${key}, expected=${tenantId}, actual=${organizationId}, userId=${userId}`,
      );
      throw new NotFoundException('Resource not found'); // 统一返回 404，不泄露存在性
    }

    // 4. 验证用户权限（检查用户是否是组织成员）
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      // 检查是否是项目所有者（已从查询中获取，无需额外查询）
      const isOwner = asset.project.ownerId === userId;
      if (!isOwner) {
        this.logger.debug(`[StorageAuth] Not Owner nor Member: User=${userId} Owner=${asset.project.ownerId}`);
        this.logger.warn(
          `[StorageAuth] User ${userId} has no access to key ${key} in tenant ${tenantId}`,
        );
        throw new NotFoundException('Resource not found'); // 统一返回 404
      }
    }

    this.logger.debug(`[StorageAuth] Access granted: key=${key}, tenantId=${tenantId}, userId=${userId}`);
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

