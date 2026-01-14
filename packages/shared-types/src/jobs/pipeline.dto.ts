/**
 * Stage 1 Pipeline DTOs
 */

export interface Stage1PipelinePayload {
    novelText: string;
    projectId?: string;
    organizationId?: string;
    novelSourceId?: string;
    chapterId?: string;
    episodeId?: string;
    pipelineRunId: string;
}

export interface Stage1PipelineResponse {
    success: boolean;
    pipelineRunId: string;
    jobId: string;
    projectId: string;
    episodeId: string;
}

export const JOB_TYPE_STAGE1_PIPELINE = 'PIPELINE_STAGE1_NOVEL_TO_VIDEO';
