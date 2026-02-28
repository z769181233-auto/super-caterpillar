import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  UnauthorizedException,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingSettlementService } from './billing-settlement.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingSettlementService: BillingSettlementService
  ) { }

  @Post('subscribe')
  async subscribe(@CurrentUser() user: AuthenticatedUser, @Body('planId') planId: string) {
    return this.billingService.createSubscription(user.userId, planId);
  }

  @Get('subscription')
  async getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getSubscription(user.userId);
  }

  @Get('plans')
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Post('settle')
  async settle(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null,
    @Body('projectId') projectId: string
  ) {
    if (!organizationId) throw new BadRequestException('Organization context missing');
    // Entry point for P1-C Settlement
    return this.billingSettlementService.settleProject(projectId);
  }

  @Get('events')
  async getEvents(
    @CurrentOrganization() organizationId: string | null,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!organizationId) throw new BadRequestException('Organization context missing');
    return this.billingService.getEvents({
      projectId,
      orgId: organizationId, // Mandatory org isolation
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      type,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('ledgers')
  async getLedgers(
    @CurrentOrganization() organizationId: string | null,
    @Query('projectId') projectId?: string,
    @Query('status') status?: any,
    @Query('jobType') jobType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!organizationId) throw new BadRequestException('Organization context missing');
    return this.billingService.getLedgers({
      projectId,
      status,
      jobType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('summary')
  async getSummary(
    @CurrentOrganization() organizationId: string | null,
    @Query('projectId') projectId?: string
  ) {
    if (!organizationId) throw new BadRequestException('Organization context missing');
    return this.billingService.getSummary(projectId, organizationId);
  }

  @Get('reconcile/status')
  async getReconcileStatus(
    @CurrentOrganization() organizationId: string | null,
    @Query('projectId') projectId: string
  ) {
    if (!organizationId) throw new BadRequestException('Organization context missing');
    if (!projectId) throw new BadRequestException('projectId is required');
    return this.billingService.getReconcileStatus(projectId);
  }

  @Get('analytics/gpu-roi')
  async getGpuRoiAnalytics(
    @Query('timeWindowHours') timeWindowHours?: string
  ) {
    return this.billingService.getGpuRoiAnalytics({
      timeWindowHours: Number(timeWindowHours || 24)
    });
  }
}
