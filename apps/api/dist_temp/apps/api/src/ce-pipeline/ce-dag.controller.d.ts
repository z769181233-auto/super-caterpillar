import { CEDagOrchestratorService } from './ce-dag-orchestrator.service';
import { CEDagRunRequestDto, CEDagRunResult } from './ce-dag.types';
export declare class CEDagController {
    private readonly orchestrator;
    constructor(orchestrator: CEDagOrchestratorService);
    runCEDag(request: CEDagRunRequestDto): Promise<CEDagRunResult>;
}
