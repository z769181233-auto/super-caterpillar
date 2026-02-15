import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { execAsync } from '../../../../../packages/shared/os_exec';
import { config } from '@scu/config';
import * as path from 'path';
import * as fs from 'fs';
import { performance } from 'perf_hooks';

/**
 * Fusion Engine Adapter (Commercial High-End)
 * - DiT + ReferenceNet + ControlNet
 * - Chains: Novel -> Prompt -> Video -> Obfuscation
 */
@Injectable()
export class FusionAdapter implements EngineAdapter {
    public readonly name = 'fusion';
    private readonly logger = new Logger(FusionAdapter.name);

    supports(engineKey: string): boolean {
        return engineKey === 'fusion' || engineKey === 'ce11_fusion_real';
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        const t0 = performance.now();
        const {
            novelText,
            referenceImageUrl,
            controlPoseUrl,
            loraId,
            projectId,
            shotId
        } = input.payload as any;

        this.logger.log(`[FusionAdapter] Starting Fusion Generation for Shot ${shotId}`);

        try {
            // @ts-ignore
            const repoRoot = config.repoRoot;
            const scriptPath = path.join(repoRoot, 'apps/fusion-engine/scripts/e2e_inference.py');
            const outputPath = path.join(config.storageRoot, `outputs/fusion_${shotId}.mp4`);

            // Ensure directory exists
            if (!fs.existsSync(path.dirname(outputPath))) {
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            }

            // Execute E2E Script
            // In a real prod env, we might use a dedicated microservice, 
            // but for local-cluster integration, direct exec is standard.
            const args = [
                '--text', novelText || 'Default scene description',
                '--output', outputPath
            ];

            // Add optional components if provided
            if (referenceImageUrl) args.push('--ref', referenceImageUrl);
            if (loraId) args.push('--lora', loraId);

            this.logger.log(`[FusionAdapter] Executing: python3 ${scriptPath} ...`);

            const res = await execAsync('python3', [scriptPath, ...args], {
                env: {
                    ...process.env,
                    PYTHONPATH: `${process.env.PYTHONPATH}:${path.join(repoRoot, 'apps/fusion-engine')}`,
                    WANDB_MODE: 'disabled',
                    PYTHONDONTWRITEBYTECODE: '1', // Prevent __pycache__ creation in watched dirs
                }
            });

            if (res.code !== 0) {
                throw new Error(`FUSION_EXEC_FAIL: ${res.stderr}`);
            }

            // Post-Process: Obfuscation
            const obfuscateScript = path.join(repoRoot, 'apps/fusion-engine/scripts/obfuscate_video.py');
            const finalOutputPath = outputPath.replace('.mp4', '_secured.mp4');

            this.logger.log(`[FusionAdapter] Obfuscating: ${outputPath} -> ${finalOutputPath}`);
            const obfRes = await execAsync('python3', [obfuscateScript, '--input', outputPath, '--output', finalOutputPath]);

            if (obfRes.code !== 0) {
                throw new Error(`FUSION_OBFUSCATE_FAIL: ${obfRes.stderr}`);
            }

            if (!fs.existsSync(finalOutputPath)) {
                throw new Error(`FUSION_OBFUSCATE_FILE_MISSING: ${finalOutputPath} was not created`);
            }

            const sha256 = await this.calculateSha256(finalOutputPath);

            return {
                status: 'SUCCESS' as any,
                output: {
                    localPath: finalOutputPath,
                    asset: {
                        uri: `outputs/fusion_${shotId}_secured.mp4`,
                        sha256
                    },
                    storageKey: `outputs/fusion_${shotId}_secured.mp4`,
                    sha256,
                    render_meta: {
                        engine: 'fusion_v1_dit',
                        status: 'SECURED',
                        obfuscated: true,
                        provider: 'local_cluster'
                    }
                },
                metrics: {
                    durationMs: Math.round(performance.now() - t0),
                }
            };
        } catch (error: any) {
            this.logger.error(`[FusionAdapter_ERROR] ${error.message}`);
            return {
                status: 'FAILED' as any,
                error: { code: 'FUSION_ADAPTER_FAIL', message: error.message },
            };
        }
    }

    private async calculateSha256(filePath: string): Promise<string> {
        const { createHash } = await import('crypto');
        const hash = createHash('sha256');
        const buffer = fs.readFileSync(filePath);
        return hash.update(buffer).digest('hex');
    }
}
