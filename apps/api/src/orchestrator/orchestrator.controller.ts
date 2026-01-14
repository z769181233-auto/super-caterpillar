import { Controller, Post, Get, UseGuards, Body } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Stage1PipelinePayload } from '@scu/shared-types';

@Controller('orchestrator')
@UseGuards(JwtOrHmacGuard)
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) { }

  /**
   * 手动触发调度
   * POST /orchestrator/dispatch
   */
  @Post('dispatch')
  async dispatch(): Promise<any> {
    const result = await this.orchestratorService.dispatch();
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取调度器统计信息（可观测性增强）
   * GET /api/orchestrator/stats
   *
   * 参考《平台日志监控与可观测性体系说明书_ObservabilityMonitoringSpec_V1.0》
   * 提供只读的调度状态快照，不执行任何调度动作
   */
  @Get('stats')
  async getStats(): Promise<any> {
    const stats = await this.orchestratorService.getStats();
    return {
      success: true,
      data: stats,
      requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 启动 Stage 1 流水线：从小说到视频
   * POST /api/orchestrator/pipeline/stage1
   */
  @Post('pipeline/stage1')
  async startStage1Pipeline(@Body() body: Stage1PipelinePayload): Promise<any> {
    const result = await this.orchestratorService.startStage1Pipeline(body);
    return {
      success: true,
      data: result,
    };
  }
}
