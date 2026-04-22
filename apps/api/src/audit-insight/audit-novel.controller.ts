import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Controller, Get, Param, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuditInsightService } from './audit-insight.service';
import { NovelAuditFullResponse } from './audit-insight.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@scu/shared-types';

@UseGuards(JwtOrHmacGuard)
@Controller('audit')
export class AuditNovelController {
  constructor(private readonly auditInsightService: AuditInsightService) {}

  /**
   * P1-B: 获取小说全量审计视图
   * 集成最新的 Job 状态、质量指标、Director 实时校验及 DAG Timeline
   */
  @Get('novel/:novelSourceId/full')
  async getNovelAuditFull(
    @Param('novelSourceId') novelSourceId: string,
    @CurrentUser() user?: AuthenticatedUser
  ): Promise<NovelAuditFullResponse> {
    if (!user?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    const userId = user.userId;
    return this.auditInsightService.getNovelAuditFull(novelSourceId, userId);
  }
}
