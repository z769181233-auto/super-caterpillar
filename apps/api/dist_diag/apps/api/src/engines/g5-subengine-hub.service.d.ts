import { EngineInvokerHubService } from '../engine-hub/engine-invoker-hub.service';
export declare class G5SubengineHubService {
    private readonly invokerHub;
    private readonly logger;
    constructor(invokerHub: EngineInvokerHubService);
    generateG5Manifest(payload: {
        story: any;
        renderPlan: any;
        outputDir: string;
        projectId: string;
        traceId: string;
    }): Promise<{
        dialogue_plan: unknown;
        motion_plan: unknown;
        layering_plan: unknown;
        staged_dir: string;
    }>;
}
