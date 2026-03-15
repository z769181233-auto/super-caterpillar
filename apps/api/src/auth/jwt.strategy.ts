import { Injectable, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '@scu/config';
const { Client } = require('pg');

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
  private readonly queryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');
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

  private isPrismaTimeout(error: unknown): boolean {
    return error instanceof Error && error.message.includes('PRISMA_QUERY_TIMEOUT');
  }

  private async withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: this.queryTimeoutMs,
      query_timeout: this.queryTimeoutMs,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async findUserViaPg(userId: string) {
    return this.withPgClient(async (client) => {
      const result = await client.query(
        `SELECT id, email, "userType", role, tier FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      return result.rows[0] || null;
    });
  }

  private async resolveOrganizationViaPg(userId: string, payloadOrgId?: string) {
    if (!payloadOrgId) return null;
    return this.withPgClient(async (client) => {
      const membership = await client.query(
        `SELECT 1 FROM organization_members WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
        [payloadOrgId, userId]
      );
      if (membership.rows[0]) return payloadOrgId;

      const owner = await client.query(
        `SELECT "ownerId" FROM organizations WHERE id = $1 LIMIT 1`,
        [payloadOrgId]
      );
      return owner.rows[0]?.ownerId === userId ? payloadOrgId : null;
    });
  }

  async validate(payload: JwtPayload) {
    // JWT validation trace
    let user: any;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          userType: true,
          role: true,
          tier: true,
        },
      });
    } catch (error) {
      if (!this.isPrismaTimeout(error)) throw error;
      this.logger.warn(`[JWT] Prisma degraded on user lookup, using pg fallback for user=${payload.sub}`);
      user = await this.findUserViaPg(payload.sub);
    }
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
      try {
        const membership = await this.prisma.organizationMember.findFirst({
          where: {
            organizationId: payload.orgId,
            userId: user.id,
          },
        });

        if (!membership) {
          const org = await this.prisma.organization.findUnique({
            where: { id: payload.orgId },
            select: { ownerId: true },
          });

          if (org && org.ownerId === user.id) {
            organizationId = payload.orgId;
          } else {
            organizationId = null;
          }
        } else {
          organizationId = payload.orgId;
        }
      } catch (error) {
        if (!this.isPrismaTimeout(error)) throw error;
        this.logger.warn(
          `[JWT] Prisma degraded on org validation, using pg fallback for user=${user.id} org=${payload.orgId}`
        );
        organizationId = await this.resolveOrganizationViaPg(user.id, payload.orgId);
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
