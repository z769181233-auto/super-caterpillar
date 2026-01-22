import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { QualityScoreService } from './quality-score.service';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';

@Controller('quality')
export class QualityGateController {
  private readonly logger = new Logger(QualityGateController.name);

  constructor(private readonly qualityScoreService: QualityScoreService) {}

  /**
   * 手动触发质量评分（门禁专用）
   */
  @Post('score')
  async triggerScoring(@Body() body: { shotId: string; traceId: string; attempt?: number }) {
    this.logger.log(`Manual scoring triggered for shot ${body.shotId}`);
    return await this.qualityScoreService.performScoring(
      body.shotId,
      body.traceId,
      body.attempt || 1
    );
  }
}
