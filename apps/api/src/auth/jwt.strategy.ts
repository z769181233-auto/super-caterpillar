import { Injectable, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '@scu/config';

export interface JwtPayload {
  sub: string;
  email: string;
  tier: string;
  orgId?: string; // Studio v0.7: 组织 ID
}

import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 优先从 cookie 读取
        (request: any) => {
          return request?.cookies?.accessToken || null;
        },
        // 兼容从 Authorization header 读取（用于向后兼容）
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || env.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    // JWT validation trace
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        userType: true,
        role: true,
        tier: true,
      },
    });
    // User lookup trace

    if (!user) {
      this.prisma.user
        .findMany()
        .then((all) => JSON.stringify(all.map((u) => u.id)))
        .then((ids) => {
          this.logger.error(
            `[DEBUG] User NOT found. Payload sub: ${payload.sub}. Available IDs: ${ids}`
          );
        });
      throw new UnauthorizedException('User not found');
    }

    // P1 修复：实时校验组织成员身份（防止时效性漏洞）
    let organizationId: string | null = null;
    if (payload.orgId) {
      // 验证用户是否仍然是组织成员
      const membership = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: payload.orgId,
          userId: user.id,
        },
      });

      // 如果用户不是成员，检查是否是组织所有者
      if (!membership) {
        const org = await this.prisma.organization.findUnique({
          where: { id: payload.orgId },
          select: { ownerId: true },
        });

        if (org && org.ownerId === user.id) {
          organizationId = payload.orgId;
        } else {
          // 用户已被移出组织，不返回 organizationId
          // 这会导致后续的权限检查失败，符合安全要求
          organizationId = null;
        }
      } else {
        organizationId = payload.orgId;
      }
    }

    return {
      userId: user.id,
      email: user.email,
      userType: user.userType,
      role: user.role,
      tier: user.tier,
      organizationId, // 已实时校验的组织 ID
    };
  }
}
