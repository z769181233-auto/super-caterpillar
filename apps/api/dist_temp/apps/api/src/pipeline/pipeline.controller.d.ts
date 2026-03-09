import { PipelineService } from './pipeline.service';
export declare class PipelineController {
    private readonly pipeline;
    constructor(pipeline: PipelineService);
    getPipeline(projectId: string): Promise<{
        success: boolean;
        data: import("./pipeline.dto").GetPipelineResponse;
    }>;
    retryNode(projectId: string, nodeId: string, req: any, body: any): Promise<{
        success: boolean;
        data: {
            ok: boolean;
            jobId: any;
        };
    }>;
    skipNode(projectId: string, nodeId: string, req: any, body: any): Promise<{
        success: boolean;
        data: {
            ok: boolean;
        };
    }>;
    forcePassNode(projectId: string, nodeId: string, req: any, body: any): Promise<{
        success: boolean;
        data: {
            ok: boolean;
        };
    }>;
}
