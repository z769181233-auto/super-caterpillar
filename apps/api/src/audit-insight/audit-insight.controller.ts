import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditInsightService } from './audit-insight.service';
import { NovelInsightResponse, JobAuditResponse } from './audit-insight.dto';

@UseGuards(JwtOrHmacGuard)
@Controller('audit-insight')
export class AuditInsightController {
  constructor(private readonly auditInsightService: AuditInsightService) {}

  @Get('novels/:novelSourceId/insight')
  async getNovelInsight(
    @Param('novelSourceId') novelSourceId: string
  ): Promise<NovelInsightResponse> {
    return this.auditInsightService.getNovelInsight(novelSourceId);
  }

  @Get('jobs/:jobId')
  async getJobAudit(@Param('jobId') jobId: string): Promise<JobAuditResponse> {
    return this.auditInsightService.getJobAudit(jobId);
  }
}
