import { Controller, Get, UseGuards, ForbiddenException, Req } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { registry } from '@scu/observability';
import type { Request } from 'express';

@Controller('admin/metrics')
@UseGuards(JwtOrHmacGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  private assertMetricsAccess(request: Request) {
    const authType = (request as any).authType;
    if (authType === 'hmac') {
      return;
    }

    const role = String((request as any).user?.role || '').toLowerCase();
    if (role === 'admin' || role === 'owner') {
      return;
    }

    throw new ForbiddenException('ADMIN JWT or internal HMAC required');
  }

  @Get('p1')
  async getP1Metrics(@Req() request: Request) {
    this.assertMetricsAccess(request);
    return this.monitoringService.getP1Metrics();
  }
}

@Controller()
export class PublicMetricsController {
  @Get('metrics')
  async getPrometheusMetrics() {
    return registry.metrics();
  }
}
