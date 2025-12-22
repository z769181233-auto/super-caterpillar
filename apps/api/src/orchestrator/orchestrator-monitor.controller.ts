import { Controller, Get } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { randomUUID } from 'crypto';

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

