import { PrismaService } from '../prisma/prisma.service';
import { GetPipelineResponse } from './pipeline.dto';
export declare class PipelineService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getPipeline(projectId: string): Promise<GetPipelineResponse>;
    retryNode(projectId: string, nodeId: string, actorId: string, reason?: string): Promise<{
        ok: boolean;
        jobId: any;
    }>;
    skipNode(projectId: string, nodeId: string, actorId: string, reason: string): Promise<{
        ok: boolean;
    }>;
    forcePassNode(projectId: string, nodeId: string, actorId: string, reason: string): Promise<{
        ok: boolean;
    }>;
    private parseNodeId;
    private writeAudit;
}
