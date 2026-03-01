import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrganizationService } from '../organization/organization.service';
import { randomUUID } from 'crypto';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { AuditLogService } from '../audit-log/audit-log.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly organizationService: OrganizationService,
    private readonly auditLogService: AuditLogService
  ) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() user: { userId: string }): Promise<any> {
    const userData = await this.userService.findById(user.userId);

    // Studio v0.7: 获取当前组织
    const currentOrganizationId = await this.organizationService.getCurrentOrganization(
      user.userId
    );
    const organizations = await this.organizationService.getUserOrganizations(user.userId);

    return {
      success: true,
      data: {
        ...userData,
        currentOrganizationId,
        organizations,
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('me/organizations/switch')
  @AuditAction(AuditActions.ORGANIZATION_SWITCH)
  async switchOrganization(
    @Body() body: { organizationId: string },
    @CurrentUser() user: { userId: string },
    @Req() request: Request
  ): Promise<any> {
    const result = await this.organizationService.switchOrganization(
      user.userId,
      body.organizationId
    );

    // S1-FIX-B: 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService
      .record({
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
      })
      .catch(() => undefined);

    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('quota')
  async getQuota(@CurrentUser() user: { userId: string }): Promise<any> {
    const quota = await this.userService.getQuota(user.userId);
    return {
      success: true,
      data: quota,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}
