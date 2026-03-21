import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { WorkerService } from './worker.service';

@UseGuards(JwtOrHmacGuard)
@Controller('workers/monitor')
export class WorkerMonitorController {
  constructor(private readonly workerService: WorkerService) {}

  @Get('stats')
  async getStats() {
    const stats = await this.workerService.getWorkerMonitorSnapshot();
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }
}
