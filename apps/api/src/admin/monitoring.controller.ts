import { Controller, Get, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { registry } from '@scu/observability';

@Controller('admin/metrics')
@UseGuards(JwtOrHmacGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('p1')
  async getP1Metrics() {
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
