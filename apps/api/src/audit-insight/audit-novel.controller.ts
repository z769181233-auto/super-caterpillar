
import { Controller, Get, Param } from '@nestjs/common';
import { AuditInsightService } from './audit-insight.service';
import { NovelAuditFullResponse } from './audit-insight.dto';

@Controller('audit')
export class AuditNovelController {
    constructor(private readonly auditInsightService: AuditInsightService) { }

    /**
     * P1-B: 获取小说全量审计视图
     * 集成最新的 Job 状态、质量指标、Director 实时校验及 DAG Timeline
     */
    @Get('novel/:novelSourceId/full')
    async getNovelAuditFull(
        @Param('novelSourceId') novelSourceId: string
    ): Promise<NovelAuditFullResponse> {
        return this.auditInsightService.getNovelAuditFull(novelSourceId);
    }
}
