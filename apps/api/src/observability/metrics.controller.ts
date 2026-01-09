import { metricsText } from '@scu/observability';
import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response) {
    res.setHeader('content-type', 'text/plain; version=0.0.4');
    res.send(await metricsText());
  }
}
