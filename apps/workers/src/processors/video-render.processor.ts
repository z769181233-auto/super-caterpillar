import { JobType, AssetOwnerType, AssetType } from 'database';
import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
// @ts-ignore
import { WorkerJob } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { exec, spawn } from 'child_process';

export interface VideoRenderProcessorResult {
    status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
    output?: any;
    error?: string;
}

export async function processVideoRenderJob(context: {
    prisma: PrismaClient;
    job: WorkerJob;
    apiClient: ApiClient;
    logger?: any;
}): Promise<VideoRenderProcessorResult> {
    const { prisma, job, apiClient } = context;
    const logger = context.logger || console;

    // 1. Validate Payload
    const payload = job.payload || {};
    const { pipelineRunId, traceId, frames } = payload;
    const episodeId = job.episodeId || payload.episodeId;
    const projectId = job.projectId || payload.projectId;

    if (!pipelineRunId) throw new Error('[VideoRender] Missing pipelineRunId');
    // Note: episodeId might be missing in job context, we will robustly fetch it later for CE09
    if (!projectId) throw new Error('[VideoRender] Missing projectId');
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
        throw new Error('[VideoRender] Missing frames list');
    }

    try {
        console.log(`[VideoRender] Processing ${frames.length} frames for run ${pipelineRunId}`);

        // 2. Resolve Paths
        const runtimeDir = path.resolve(process.cwd(), '.runtime');
        const framePaths = frames.map((key: string) => path.resolve(runtimeDir, key));

        // Verify frames exist
        for (const fp of framePaths) {
            if (!fs.existsSync(fp)) {
                throw new Error(`[VideoRender] Frame not found: ${fp}`);
            }
        }

        // 3. Synthesis Logic
        const outputRelativeKey = `renders/${projectId}/${episodeId || 'project_level'}/${pipelineRunId}/output.mp4`;
        const outputPath = path.resolve(runtimeDir, outputRelativeKey);

        // Ensure dir exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const renderEngine = process.env.RENDER_ENGINE || 'mock';

        if (renderEngine === 'ffmpeg') {
            // REAL (FFmpeg concat demuxer)
            logger.log(`[VideoRender] Starting FFmpeg render (concat demuxer)...`);

            // A. Fail-fast dependency check
            try {
                await new Promise((resolve, reject) => {
                    const check = spawn('ffmpeg', ['-version']);
                    check.on('error', reject);
                    check.on('close', (code) => {
                        if (code === 0) resolve(true);
                        else reject(new Error(`ffmpeg check exited with code ${code}`));
                    });
                });
            } catch (e: any) {
                throw new Error(`[VideoRender] FFmpeg binary missing or not executable: ${e.message}`);
            }

            // B. Prepare concat list
            const concatListPath = path.join(outputDir, `frames_${pipelineRunId}.txt`);
            const concatContent = framePaths.map((fp: string) => `file '${fp}'`).join('\n');
            fs.writeFileSync(concatListPath, concatContent);

            // C. Execute FFmpeg
            // Command: ffmpeg -f concat -safe 0 -i frames.txt -r 24 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -y output.mp4
            const args = [
                '-r',
                '24',
                '-f',
                'concat',
                '-safe',
                '0',
                '-i',
                concatListPath,
                '-c:v',
                'libx264',
                '-pix_fmt',
                'yuv420p',
                '-movflags',
                '+faststart',
                '-y',
                outputPath,
            ];

            logger.log(`[VideoRender] Executing: ffmpeg ${args.join(' ')}`);

            await new Promise<void>((resolve, reject) => {
                const child = spawn('ffmpeg', args);

                // Capture logs for audit
                const logPath = path.join(outputDir, `ffmpeg_${pipelineRunId}.log`);
                const logStream = fs.createWriteStream(logPath, { flags: 'a' });

                child.stdout.pipe(logStream);
                child.stderr.pipe(logStream);

                const timeout = setTimeout(() => {
                    child.kill('SIGKILL');
                    reject(new Error('[VideoRender] FFmpeg execution timed out (60s)'));
                }, 60000); // 60s timeout

                child.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(new Error(`[VideoRender] FFmpeg spawn error: ${err.message}`));
                });

                child.on('close', (code) => {
                    clearTimeout(timeout);
                    logStream.end();
                    if (code === 0) {
                        // Check if output exists and size > 0
                        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                            resolve();
                        } else {
                            reject(new Error('[VideoRender] FFmpeg exited 0 but output file empty/missing'));
                        }
                    } else {
                        reject(
                            new Error(`[VideoRender] FFmpeg exited with code ${code}. See logs: ${logPath}`)
                        );
                    }
                });
            });

            logger.log(`[VideoRender] FFmpeg render success: ${outputPath}`);
        } else {
            // MOCK: Just write a text file with .mp4 extension or concat content
            const content = `FAKE MP4 CONTAINER\nRun: ${pipelineRunId}\nFrames: ${frames.length}\nSources: ${frames.join(', ')}`;
            fs.writeFileSync(outputPath, content);
            logger.log(`[VideoRender] Mock MOCK synthesized to ${outputPath}`);
        }

        // 4. Persistence (Asset)
        let targetOwnerId = job.shotId || (payload.shotId as string);

        if (!targetOwnerId && frames.length > 0) {
            console.warn(
                '[VideoRender] Missing shotId, attempting to synthesize without valid owner (will fail persistence)'
            );
        }

        if (!targetOwnerId) {
            throw new Error(
                '[VideoRender] Missing shotId for Asset ownership (Required by Schema Asset_Shot_fkey)'
            );
        }

        const asset = await prisma.asset.upsert({
            where: {
                ownerType_ownerId_type: {
                    ownerType: AssetOwnerType.SHOT,
                    ownerId: targetOwnerId,
                    type: AssetType.VIDEO,
                },
            },
            update: {
                storageKey: outputRelativeKey,
            },
            create: {
                projectId: projectId,
                ownerId: targetOwnerId,
                ownerType: AssetOwnerType.SHOT,
                type: AssetType.VIDEO,
                storageKey: outputRelativeKey,
                status: 'GENERATED',
                createdByJobId: job.id,
            },
        });

        // 5. Audit
        await prisma.auditLog.create({
            data: {
                resourceType: 'asset', // or video
                resourceId: asset.id,
                action: 'ce07.video_render.success',
                orgId: job.organizationId,
                details: {
                    jobId: job.id,
                    framesCount: frames.length,
                    storageKey: outputRelativeKey,
                    engine: process.env.RENDER_ENGINE || 'mock',
                },
            },
        });

        // 5.5 Billing (P0 Hotfix: CPU Seconds)
        const costService = new CostLedgerService(apiClient);
        await costService.recordEngineBilling({
            jobId: job.id,
            jobType: 'VIDEO_RENDER',
            traceId: traceId || job.id,
            projectId,
            userId: 'system',
            orgId: job.organizationId || 'org?unknown',
            engineKey: 'video_render',
            runId: pipelineRunId,
            cpuSeconds: 12.0, // Mock duration (0.5s * 24 frames)
            cost: 0.12 // Mock cost
        });

        // 6. Spawn Media Security (CE09) - S4-5
        // Idempotency: Check if CE09 job already exists for this pipelineRunId
        const existingCe09 = await prisma.shotJob.findFirst({
            where: {
                projectId,
                type: JobType.CE09_MEDIA_SECURITY,
                payload: {
                    path: ['pipelineRunId'],
                    equals: pipelineRunId,
                },
            },
        });

        if (!existingCe09) {
            const msg = `[VideoRender] Spawning CE09_MEDIA_SECURITY for run ${pipelineRunId}\n`;
            console.log(msg);
            fs.appendFileSync('processor-debug-v2.log', msg);

            try {
                // ROBUST FETCH: Segregated context retrieval

                // A. Organization ID from Project (reliable)
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { organizationId: true },
                });
                if (!project) throw new Error(`Project ${projectId} not found`);
                const resolvedOrgId = job.organizationId || project.organizationId;

                // B. Episode/Scene ID from Shot Hierarchy (reliable)
                // Schema: Shot -> Scene -> Episode
                const shotWithHierarchy = await prisma.shot.findUnique({
                    where: { id: targetOwnerId },
                    include: {
                        scene: {
                            include: {
                                episode: true,
                            },
                        },
                    },
                });

                if (!shotWithHierarchy) {
                    throw new Error(
                        `[VideoRender] CE09 spawn failed: shot not found shotId=${targetOwnerId}`
                    );
                }

                const resolvedSceneId = shotWithHierarchy.scene?.id;
                const resolvedEpisodeId = shotWithHierarchy.scene?.episode?.id;

                if (!resolvedEpisodeId) {
                    throw new Error(
                        `[VideoRender] CE09 spawn failed: episodeId missing via Shot->Scene->Episode chain`
                    );
                }

                // C. Create Job with CONNECT
                await prisma.shotJob.create({
                    data: {
                        type: JobType.CE09_MEDIA_SECURITY,
                        organization: { connect: { id: resolvedOrgId } },
                        project: { connect: { id: projectId } },
                        shot: { connect: { id: targetOwnerId } },
                        scene: { connect: { id: resolvedSceneId } },
                        episode: { connect: { id: resolvedEpisodeId } },
                        payload: {
                            videoAssetStorageKey: outputRelativeKey,
                            pipelineRunId,
                            traceId,
                            shotId: targetOwnerId,
                            projectId,
                        },
                    },
                });

                fs.appendFileSync(
                    'processor-debug-v2.log',
                    `[VideoRender] CE09 Spawned successfully (Org:${resolvedOrgId} Ep:${resolvedEpisodeId})\n`
                );
            } catch (e: any) {
                const errMsg = `[VideoRender] CE09 Spawn Failed: ${e.message}\n`;
                console.error(errMsg);
                fs.appendFileSync('processor-debug-v2.log', errMsg);
                throw e;
            }
        } else {
            const msg = `[VideoRender] CE09_MEDIA_SECURITY already exists for run ${pipelineRunId}, skipping spawn.\n`;
            console.log(msg);
            fs.appendFileSync('processor-debug-v2.log', msg);
        }

        return {
            status: 'SUCCEEDED',
            output: {
                assetId: asset.id,
                storageKey: outputRelativeKey,
                absoluatePath: outputPath,
            },
        };
    } catch (error: any) {
        logger.error(`[VideoRender] Failed: ${error.message}`);
        throw error;
    }
}
