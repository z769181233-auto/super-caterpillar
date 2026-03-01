import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole } from 'database';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取用户所属的所有组织
   */
  async getUserOrganizations(userId: string): Promise<any> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m: any) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * 创建组织
   */
  async createOrganization(userId: string, name: string, slug?: string): Promise<any> {
    // 检查 slug 是否已存在
    if (slug) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug },
      });
      if (existing) {
        throw new ForbiddenException('Organization slug already exists');
      }
    }

    // 创建组织并添加创建者为 OWNER
    const organization = await this.prisma.organization.create({
      data: {
        name,
        slug,
        ownerId: userId, // 设置 ownerId
        members: {
          create: {
            userId,
            role: OrganizationRole.OWNER,
          },
        },
      },
    });

    return organization;
  }

  /**
   * 获取组织详情
   */
  async getOrganizationById(organizationId: string, userId: string): Promise<any> {
    // 检查用户是否属于该组织
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    return {
      ...membership.organization,
      role: membership.role,
    };
  }

  /**
   * 获取用户的当前组织（用于登录后确定默认组织）
   */
  async getCurrentOrganization(userId: string): Promise<string | null> {
    // 1. 优先使用 User.defaultOrganizationId
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });

    if (user?.defaultOrganizationId) {
      // 验证用户是否仍属于该组织
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: user.defaultOrganizationId,
          },
        },
      });

      if (membership) {
        return user.defaultOrganizationId;
      }
    }

    // 2. 使用用户第一个 OrganizationMember
    const firstMembership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (firstMembership) {
      return firstMembership.organizationId;
    }

    // 3. 如果用户还没有组织，自动创建一个个人组织
    const personalOrg = await this.createOrganization(
      userId,
      `Personal Organization (${userId.substring(0, 8)})`
    );

    // 更新用户的默认组织
    await this.prisma.user.update({
      where: { id: userId },
      data: { defaultOrganizationId: personalOrg.id },
    });

    return personalOrg.id;
  }

  /**
   * 切换用户的当前组织
   */
  async switchOrganization(userId: string, organizationId: string) {
    // 检查用户是否属于该组织
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // 更新用户的默认组织
    await this.prisma.user.update({
      where: { id: userId },
      data: { defaultOrganizationId: organizationId },
    });

    // 获取组织信息
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });

    return {
      organizationId,
      role: membership.role,
      organization,
    };
  }

  /**
   * 获取用户在组织中的角色
   */
  async getUserRole(userId: string, organizationId: string): Promise<OrganizationRole | null> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    return membership?.role || null;
  }
}
