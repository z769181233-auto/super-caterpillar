import { Controller, Get, Post, Body, Param, UseGuards, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { OrganizationService } from './organization.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { randomUUID } from 'crypto';
import { env } from 'config';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { AuditLogService } from '../audit-log/audit-log.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  async getUserOrganizations(@CurrentUser() user: { userId: string }): Promise<any> {
    const organizations = await this.organizationService.getUserOrganizations(user.userId);
    return {
      success: true,
      data: organizations,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createOrganization(
    @Body() body: { name: string; slug?: string },
    @CurrentUser() user: { userId: string }
  ): Promise<any> {
    const organization = await this.organizationService.createOrganization(
      user.userId,
      body.name,
      body.slug
    );
    return {
      success: true,
      data: organization,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getOrganization(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string }
  ): Promise<any> {
    const organization = await this.organizationService.getOrganizationById(id, user.userId);
    return {
      success: true,
      data: organization,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('switch')
  @AuditAction(AuditActions.ORGANIZATION_SWITCH)
  async switchOrganization(
    @Body() body: { organizationId: string },
    @CurrentUser() user: { userId: string; email: string; tier: string },
    @Res({ passthrough: true }) res: Response,
    @Req() request: Request,
  ): Promise<any> {
    // Studio v0.7: 切换组织并重新签发 JWT
    const result = await this.organizationService.switchOrganization(user.userId, body.organizationId);
    
    // S1-FIX-B: 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.ORGANIZATION_SWITCH,
      resourceType: 'organization',
      resourceId: body.organizationId,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: {
        organizationName: result.organization?.name,
        role: result.role,
      },
    }).catch(() => undefined);
    
    // 重新签发 tokens（包含新的 organizationId）
    const tokens = await this.authService.generateTokens(user.userId, user.email, user.tier, body.organizationId);
    
    // 设置 cookies
    const isProduction = env.isProduction;
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    if (tokens.refreshToken) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }
    
    return {
      success: true,
      data: {
        ...result,
        message: `Switched to organization ${result.organization?.name || result.organizationId}`,
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}











