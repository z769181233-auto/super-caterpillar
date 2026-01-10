import { Injectable, UnauthorizedException, ConflictException, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '@scu/config';
import { UserRole } from 'database';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(JwtService)
    private readonly jwtService: JwtService
  ) { }

  async register(registerDto: RegisterDto) {
    const { email, password, userType = 'individual' as any } = registerDto;

    // 1. 预检查 email 是否已存在 (外部快速失败，减少事务开销)
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. 哈希密码
    const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

    // 3. 事务处理：User + Org + Membership
    const { user, organizationId } = await this.prisma.$transaction(async (tx) => {
      // a) 创建用户
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          userType,
          role: UserRole.creator, // 统一 lowercase
          tier: 'Free',
          quota: {
            remainingTokens: 1000,
            computeSeconds: 3600,
            credits: 100,
          },
        },
      });

      // b) 幂等创建个人组织 (确保 ownerId_type 唯一约束)
      const org = await tx.organization.upsert({
        where: {
          ownerId_type: {
            ownerId: newUser.id,
            type: 'PERSONAL',
          },
        },
        update: {},
        create: {
          name: `Personal Org (${email})`,
          slug: `personal-${newUser.id.substring(0, 8)}`,
          ownerId: newUser.id,
          type: 'PERSONAL',
        },
      });

      // c) 幂等创建 Membership (userId_organizationId 唯一)
      await tx.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: newUser.id,
            organizationId: org.id,
          },
        },
        update: { role: 'OWNER' },
        create: {
          userId: newUser.id,
          organizationId: org.id,
          role: 'OWNER',
        },
      });

      // d) 更新用户默认组织
      await tx.user.update({
        where: { id: newUser.id },
        data: { defaultOrganizationId: org.id },
      });

      this.logger.log(`[AUTH_REG] Success: userId=${newUser.id} orgId=${org.id} role=OWNER`);

      return { user: newUser, organizationId: org.id };
    });

    // 4. 生成 tokens
    const tokens = await this.generateTokens(user.id, user.email, user.tier, organizationId);

    return {
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          avatar: user.avatar,
          userType: user.userType,
          role: user.role,
          tier: user.tier,
          organizationId, // 返回时包含组织 ID
        },
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 查询用户
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Studio v0.7: 获取当前组织 (解耦 OrganizationService)
    let organizationId = await this.getCurrentOrganization(user.id);

    // FIX: 如果用户没有任何组织成员关系（可能是老数据或脏数据），自动补齐个人组织
    if (!organizationId) {
      this.logger.warn(
        `[AUTH_FIX] User ${user.email} (id=${user.id}) has no organization. Creating Personal Org...`
      );
      await this.ensurePersonalOrganization(user.id, user.email);
      organizationId = await this.getCurrentOrganization(user.id);
    }

    // 生成 tokens（包含 organizationId）
    const tokens = await this.generateTokens(user.id, user.email, user.tier, organizationId);

    return {
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          avatar: user.avatar,
          userType: user.userType,
          role: user.role,
          tier: user.tier,
        },
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  async refresh(refreshToken: string) {
    try {
      // 验证 refresh token（使用 refresh secret）
      const payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as {
        sub: string;
        email: string;
        tier: string;
        type: string;
      };

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 查询用户
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Studio v0.7: 获取当前组织
      const currentOrganizationId = await this.getCurrentOrganization(user.id);

      // 生成新的 access token（包含组织 ID）
      const accessToken = await this.generateAccessToken(
        user.id,
        user.email,
        user.tier,
        currentOrganizationId
      );

      return {
        success: true,
        data: {
          accessToken,
        },
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async generateTokens(userId: string, email: string, tier: string, organizationId: string | null) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, email, tier, organizationId),
      this.generateRefreshToken(userId, email, tier, organizationId),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(
    userId: string,
    email: string,
    tier: string,
    organizationId: string | null
  ) {
    const payload = {
      sub: userId,
      email,
      tier,
      orgId: organizationId, // Studio v0.7: 组织 ID
    };
    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(
    userId: string,
    email: string,
    tier: string,
    organizationId: string | null
  ) {
    const payload = {
      sub: userId,
      email,
      tier,
      orgId: organizationId, // Studio v0.7: 组织 ID
      type: 'refresh',
    };
    // TODO: 实现 refresh token 黑名单 / 轮转策略
    return jwt.sign(payload, env.jwtRefreshSecret, {
      expiresIn: env.jwtRefreshExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * 内部实现：获取用户当前的默认组织 (替代 OrganizationService 调用以打破循环依赖)
   */
  private async getCurrentOrganization(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });

    if (user?.defaultOrganizationId) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: user.defaultOrganizationId,
          },
        },
      });
      if (membership) return user.defaultOrganizationId;
    }

    const firstMembership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return firstMembership?.organizationId || null;
  }

  /**
   * 补齐用户个人组织（幂等）
   */
  private async ensurePersonalOrganization(userId: string, email: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // b) 幂等创建个人组织 (确保 ownerId_type 唯一约束)
      const org = await tx.organization.upsert({
        where: {
          ownerId_type: {
            ownerId: userId,
            type: 'PERSONAL',
          },
        },
        update: {},
        create: {
          name: `Personal Org (${email})`,
          slug: `personal-${userId.substring(0, 8)}`,
          ownerId: userId,
          type: 'PERSONAL',
        },
      });

      // c) 幂等创建 Membership (userId_organizationId 唯一)
      await tx.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: org.id,
          },
        },
        update: { role: 'OWNER' },
        create: {
          userId: userId,
          organizationId: org.id,
          role: 'OWNER',
        },
      });

      // d) 更新用户默认组织 (如果为空)
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.defaultOrganizationId) {
        await tx.user.update({
          where: { id: userId },
          data: { defaultOrganizationId: org.id },
        });
      }
    });
  }
}
