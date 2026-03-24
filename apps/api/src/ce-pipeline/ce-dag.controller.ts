import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { CEDagOrchestratorService } from './ce-dag-orchestrator.service';
import { CEDagRunRequestDto, CEDagRunResult } from './ce-dag.types';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';

/**
 * CE DAG Controller
 * Phase 3: API trigger entry point
 *
 * POST /api/ce-dag/run
 * Input: { projectId, novelSourceId, shotId }
 * Output: { runId, traceId, jobIds, scores }
 */
@Controller('ce-dag')
@UseGuards(JwtOrHmacGuard)
export class CEDagController {
  private readonly logger = new Logger(CEDagController.name);

  constructor(private readonly orchestrator: CEDagOrchestratorService) {}

  @Post('run')
  async runCEDag(@Body() request: CEDagRunRequestDto): Promise<CEDagRunResult> {
    this.logger.log(`[CE_DAG_CONTROLLER] runCEDag shotId=${request.shotId}`);
    try {
      const result = await this.orchestrator.runCEDag(request);
      return result;
    } catch (error: any) {
      this.logger.error(`[CE_DAG_CONTROLLER] runCEDag failed: ${error?.message || 'unknown'}`);
      throw error;
    }
  }
}
