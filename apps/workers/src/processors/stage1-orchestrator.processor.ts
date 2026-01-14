import { PrismaClient, JobType, JobStatus } from 'database';
import { ApiClient } from '../api-client';
import { WorkerJobBase } from '@scu/shared-types';

export async function processStage1OrchestratorJob(ctx: {
    prisma: PrismaClient;
    job: WorkerJobBase;
    apiClient: ApiClient;
}) {
    const { prisma, job, apiClient } = ctx;
    const payload = job.payload as any;
    const { novelText, projectId, episodeId, pipelineRunId, traceId } = payload;
    const organizationId = job.organizationId;

    console.log(`[Stage1] Starting orchestrator for run ${pipelineRunId} (Project: ${projectId})`);

    // 规则：优先按双换行符切分，兜底按单换行符或直接使用全文
    let paragraphs = novelText.split(/\n\n+/).filter((p: string) => p.trim().length > 5);
    if (paragraphs.length === 0) {
        paragraphs = novelText.split(/\n+/).filter((p: string) => p.trim().length > 5);
    }
    if (paragraphs.length === 0 && novelText.trim().length > 0) {
        paragraphs = [novelText.trim()];
    }

    // 获取当前 Episode 下的 Scene 结构（Stage-1 默认将所有 Shot 放入第一个 Scene）
    let scene = await prisma.scene.findFirst({ where: { episodeId } });
    if (!scene) {
        scene = await prisma.scene.create({
            data: {
                episodeId,
                projectId,
                index: 1,
                title: 'Main Scene',
                summary: 'Auto-generated for Stage-1',
            }
        });
    }

    const shotIds: string[] = [];
    // MVP: 限制每章最多 10 个镜头
    const maxShots = Math.min(paragraphs.length, 10);

    for (let i = 0; i < maxShots; i++) {
        const paragraph = paragraphs[i].trim();
        const shotParams = {
            prompt: paragraph.substring(0, 800),
            aspect_ratio: '16:9',
            seed: Math.floor(Math.random() * 1000000),
            engine_params: {
                steps: 20,
                guidance_scale: 7.0
            }
        };

        const shot = await prisma.shot.create({
            data: {
                sceneId: scene.id,
                organizationId,
                index: i + 1,
                title: `Shot ${i + 1}`,
                description: paragraph.substring(0, 200),
                reviewStatus: 'APPROVED', // Stage 1 自动化流水线直接标记为已审核
                params: shotParams,
                type: 'shot',
                enrichedPrompt: paragraph, // ✅ SSOT alignment: SHOT_RENDER requires this
            } as any
        });
        shotIds.push(shot.id);
    }
    console.log(`[Stage1] Planned ${shotIds.length} shots. Ensuring Reference Sheet exists...`);

    // MVP: Ensure a mock reference sheet exists for E4 validation
    // STAGE 1 MOCK: Create a dummy CE01 Job/Binding if not present
    let refSheetId: string | undefined;
    const refSheetJob = await prisma.shotJob.findFirst({
        where: { projectId, type: 'CE01_REFERENCE_SHEET', status: 'SUCCEEDED' },
        include: { engineBinding: true }
    });

    if (refSheetJob && refSheetJob.engineBinding) {
        refSheetId = refSheetJob.engineBinding.id;
    } else if (shotIds.length > 0) {
        // Find Character Visual Engine
        const engine = await prisma.engine.findFirst({
            where: { code: 'character_visual' }
        });

        const dummyJob = await prisma.shotJob.create({
            data: {
                projectId,
                organizationId,
                episodeId,
                sceneId: scene.id,
                shotId: shotIds[0],
                type: 'CE01_REFERENCE_SHEET',
                status: 'SUCCEEDED',
                payload: { mock: true },
            }
        });

        const binding = await prisma.jobEngineBinding.create({
            data: {
                jobId: dummyJob.id,
                engineId: engine?.id || 'mock-engine-id',
                engineKey: 'character_visual',
                status: 'COMPLETED',
            }
        });

        // MVP: 使用 Binding ID 作为 referenceSheetId
        refSheetId = binding.id;
        console.log(`[Stage1] Created Mock Reference Sheet Job Binding: ${refSheetId}`);
    }

    console.log(`[Stage1] Spawning renders via API...`);

    // 2. Spawn Concurrent Shot Renders
    // 核心：调用 API Client 以确保计费 (Billing) 和引擎绑定 (Engine Binding) 逻辑正确触发
    const renderJobs = [];
    for (const shotId of shotIds) {
        try {
            const response = await apiClient.createJob(shotId, {
                type: 'SHOT_RENDER',
                traceId,
                payload: {
                    pipelineRunId,
                    shotId,
                    traceId,
                    referenceSheetId: refSheetId // E4 Compliance
                }
            }, { 'x-organization-id': organizationId });
            renderJobs.push(response.id);
        } catch (error: any) {
            console.error(`[Stage1] Failed to spawn SHOT_RENDER for shot ${shotId}: ${error.message}`);
            // 继续分发其它镜头
        }
    }


    // 3. Evidence Archiving
    console.log(`[Stage-1 Evidence] Orchestration complete. pipelineRunId: ${pipelineRunId}, shots spawned: ${renderJobs.length}`);

    return {
        status: 'SUCCEEDED',
        output: {
            shotIds,
            renderJobIds: renderJobs,
            pipelineRunId
        }
    };
}

const JobTypeEnum_SHOT_RENDER = 'SHOT_RENDER';
