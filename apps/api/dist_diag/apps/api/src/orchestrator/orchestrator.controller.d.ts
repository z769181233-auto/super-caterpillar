import { OrchestratorService } from './orchestrator.service';
import { Stage1PipelinePayload } from '@scu/shared-types';
export declare class OrchestratorController {
    private readonly orchestratorService;
    constructor(orchestratorService: OrchestratorService);
    dispatch(): Promise<any>;
    getStats(): Promise<any>;
    startStage1Pipeline(body: Stage1PipelinePayload): Promise<any>;
}
