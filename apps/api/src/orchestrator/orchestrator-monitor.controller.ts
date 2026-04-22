import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { randomUUID } from 'crypto';

@UseGuards(JwtOrHmacGuard)
@Controller('orchestrator/monitor')
export class OrchestratorMonitorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Get('stats')
  async getStats() {
    const stats = await this.orchestratorService.getStats();
    return {
      success: true,
      data: stats,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}
