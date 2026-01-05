import { Controller, Post, Body } from '@nestjs/common';
import { CEDagOrchestratorService } from './ce-dag-orchestrator.service';
import { CEDagRunRequestDto, CEDagRunResult } from './ce-dag.types';

/**
 * CE DAG Controller
 * Phase 3: API trigger entry point
 *
 * POST /api/ce-dag/run
 * Input: { projectId, novelSourceId, shotId }
 * Output: { runId, traceId, jobIds, scores }
 */
@Controller('ce-dag')
export class CEDagController {
  constructor(private readonly orchestrator: CEDagOrchestratorService) {}

  @Post('run')
  async runCEDag(@Body() request: CEDagRunRequestDto): Promise<CEDagRunResult> {
    return this.orchestrator.runCEDag(request);
  }
}
