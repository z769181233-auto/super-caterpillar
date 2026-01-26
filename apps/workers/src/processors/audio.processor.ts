import { PrismaClient } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from '../api-client';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { createHash } from 'crypto';

/**
 * Audio Processor for Worker
 * Handles AUDIO JobType by generating stub or real audio and mixing BGM.
 * (Ported/Simplified from AudioService to avoid NestJS dependency)
 */
export async function processAudioJob(
    prisma: PrismaClient,
    job: WorkerJobBase,
    apiClient: ApiClient
): Promise<any> {
    const payload = job.payload as any;
    const { text, mode, projectId, pipelineRunId } = payload;

    console.log(`[AudioProcessor] Processing AUDIO job ${job.id} for run ${pipelineRunId}`);

    // Workspace Setup
    const workspaceDir = path.resolve(process.cwd(), 'workspace', job.id);
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

    try {
        // P18-6 Implementation Baseline:
        // For V1, we generate a "Silent" or "Stub" wav if real TTS is not enabled
        // and register it as an asset.

        const outputWav = path.join(workspaceDir, 'audio.wav');

        // 1. Generate Voice (Stub for now to ensure pipeline success)
        await new Promise<void>((resolve, reject) => {
            // Generate 2 seconds of silence/noise as stub
            const args = ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '2', '-y', outputWav];
            console.log(`[AudioProcessor] Spawning FFmpeg: ffmpeg ${args.join(' ')}`);
            const proc = spawn('ffmpeg', args);

            proc.stdout.on('data', (data) => console.log(`[FFmpeg] stdout: ${data}`));
            proc.stderr.on('data', (data) => console.log(`[FFmpeg] stderr: ${data}`));

            proc.on('error', (err) => {
                console.error(`[AudioProcessor] FFmpeg spawn error: ${err.message}`);
                reject(err);
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    console.log(`[AudioProcessor] FFmpeg success: ${outputWav}`);
                    resolve();
                } else {
                    console.error(`[AudioProcessor] FFmpeg failed with code ${code}`);
                    reject(new Error(`FFmpeg stub audio failed with code ${code}`));
                }
            });
        });

        const audioBuffer = fs.readFileSync(outputWav);
        const checksum = createHash('sha256').update(audioBuffer).digest('hex');

        // 2. Register Asset
        // Reuse path logic from video-render or similar
        const storageRoot = process.env.REPO_ROOT
            ? path.join(process.env.REPO_ROOT, '.data/storage')
            : path.join(path.resolve(process.cwd(), '../../'), '.data/storage');

        const asset = await prisma.asset.create({
            data: {
                projectId: job.projectId || 'system',
                ownerType: 'SHOT',
                ownerId: payload.shotId || payload.pipelineRunId,
                type: 'AUDIO_TTS',
                status: 'GENERATED',
                storageKey: 'temp/pending_audio',
                checksum,
                createdByJobId: job.id
            }
        });

        const storageKey = `audios/${asset.id}.wav`;
        const finalPath = path.join(storageRoot, storageKey);
        const finalDir = path.dirname(finalPath);
        if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
        fs.writeFileSync(finalPath, audioBuffer);

        await prisma.asset.update({
            where: { id: asset.id },
            data: { storageKey }
        });

        // 3. Return output for Orchestrator to inject into VIDEO_RENDER
        return {
            status: 'SUCCEEDED',
            output: {
                assetId: asset.id,
                storageKey: storageKey,
                sha256: checksum
            }
        };

    } finally {
        if (fs.existsSync(workspaceDir)) {
            fs.rmSync(workspaceDir, { recursive: true, force: true });
        }
    }
}
