import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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
  constructor(private readonly orchestrator: CEDagOrchestratorService) { }

  @Post('run')
  async runCEDag(@Body() request: CEDagRunRequestDto): Promise<CEDagRunResult> {
    console.log(`[CE_DAG_CONTROLLER] [DEBUG] Entering runCEDag with request for shotId=${request.shotId}`);
    try {
      const result = await this.orchestrator.runCEDag(request);
      console.log(`[CE_DAG_CONTROLLER] [DEBUG] Returning success result`);
      return result;
    } catch (error: any) {
      console.error(`[CE_DAG_CONTROLLER] [DEBUG] CAUGHT ERROR: ${error.message}`);
      throw error;
    }
  }
}
