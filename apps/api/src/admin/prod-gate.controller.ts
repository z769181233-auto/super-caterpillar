import { Controller, Post, Body, UseGuards, Logger, BadRequestException } from '@nestjs/common';
import { EngineRegistry } from '../engine/engine-registry.service';
import { ShotRenderRouterAdapter } from './../engines/adapters/shot-render.router.adapter';
import { EngineInvokeInput } from '@scu/shared-types';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

/**
 * Prod Gate Controller (Phase 0-R)
 * 
 * Only active when GATE_MODE=1.
 * Provides controlled entry points for automated gate scripts.
 */
@Controller('admin/prod-gate')
export class ProdGateController {
    private readonly logger = new Logger(ProdGateController.name);

    constructor(
        private readonly registry: EngineRegistry,
        private readonly shotRouter: ShotRenderRouterAdapter,
        private readonly orchestratorService: OrchestratorService
    ) { }

    /**
     * Directly trigger a shot render for validation
     */
    @Post('shot-render')
    async triggerShotRender(@Body() body: { prompt: string; seed?: number; jobId?: string; projectId: string }) {
        if (process.env.GATE_MODE !== '1') {
            throw new BadRequestException('Endpoint only available in GATE_MODE=1');
        }

        this.logger.log(`[ProdGate] Received shot-render trigger for prompt: ${body.prompt.substring(0, 30)}...`);

        const input: EngineInvokeInput = {
            engineKey: 'shot_render',
            jobType: 'SHOT_RENDER',
            payload: {
                prompt: body.prompt,
                seed: body.seed || Math.floor(Math.random() * 1000000),
            },
            context: {
                jobId: body.jobId || `gate_job_${Date.now()}`,
                projectId: body.projectId,
            },
        };

        const result = await this.shotRouter.invoke(input);

        if (result.status === 'FAILED') {
            return {
                success: false,
                error: result.error,
            };
        }

        return {
            success: true,
            data: result.output,
            metrics: result.metrics,
        };
    }

    /**
     * Trigger Stage 1 Novel-to-Video Pipeline
     */
    @Post('stage1-pipeline')
    async triggerStage1Pipeline(@Body() body: { novelText: string; projectId?: string; organizationId?: string }) {
        if (process.env.GATE_MODE !== '1') {
            throw new BadRequestException('Endpoint only available in GATE_MODE=1');
        }
        this.logger.log(`[ProdGate] Starting Stage 1 Pipeline for project: ${body.projectId}`);
        const result = await this.orchestratorService.startStage1Pipeline(body);
        return { success: true, data: result };
    }
}
