import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sceneCompositionRealEngine } from '@scu/engines-scene-composition';

const execAsync = promisify(exec);

interface CompositionElement {
    id: string; // Added id for AI tracking
    url: string;
    description?: string; // Added description for AI context
    x?: number;
    y?: number;
    scale?: number;
}

@Injectable()
export class SceneCompositionAdapter implements EngineAdapter {
    public readonly name = 'scene_composition';
    private readonly logger = new Logger(SceneCompositionAdapter.name);

    constructor(
        private readonly redisService: RedisService,
        private readonly auditService: AuditService,
        private readonly costLedgerService: CostLedgerService
    ) { }

    supports(engineKey: string): boolean {
        return engineKey === 'scene_composition';
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        const payload = input.payload || {};
        const bgUrl = payload.background_url || '';
        const elements: CompositionElement[] = payload.elements || [];

        if (!bgUrl) {
            return {
                status: 'FAILED' as any,
                error: { code: 'SCENE_NO_BG', message: 'Missing background_url' }
            };
        }

        // 1. Calculate Cache Key (SHA256 of bg + elements)
        const inputStr = JSON.stringify({ bgUrl, elements });
        const inputHash = createHash('sha256').update(inputStr).digest('hex');
        const cacheKey = `scene_comp:v2:${inputHash}`;

        // 2. Check Cache
        try {
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                await this.auditHelper(input, 'HIT', cacheKey);
                await this.recordCost(input, 0, { cached: true });
                return {
                    status: 'SUCCESS' as any,
                    output: {
                        ...cached,
                        source: 'cache',
                        meta: { inputHash, cached: true }
                    }
                };
            }
        } catch (e) {
            this.logger.warn(`Cache check failed: ${e}`);
        }

        try {
            // 3. AI Composition Decision
            const aiResult = await sceneCompositionRealEngine({
                scene_description: payload.scene_description || payload.text || 'Normal composition',
                background_url: bgUrl,
                elements: elements as any
            });

            // 4. Perform Composition (FFmpeg)
            const outputUrl = await this.composite(bgUrl, aiResult.elements, inputHash);

            const output = {
                url: outputUrl,
                status: 'success',
                layers: elements.length + 1,
                composition_mode: aiResult.composition_mode,
                ai_description: aiResult.description
            };

            // 5. Save Cache (7 days)
            await this.redisService.setJson(cacheKey, output, 7 * 24 * 3600);

            // 6. Audit & Cost
            await this.auditHelper(input, 'MISS', cacheKey);
            await this.recordCost(input, 1);

            return {
                status: 'SUCCESS' as any,
                output: {
                    ...output,
                    source: 'render',
                    ai_audit: aiResult.audit_trail.engine_version
                }
            };

        } catch (error: any) {
            this.logger.error(`[SceneComposition] Failed: ${error.message}`);
            // Failure Audit
            await this.auditHelper(input, 'MISS', 'failed_request', { status: 'FAILED', error: error.message });
            await this.recordCost(input, 0, { status: 'FAILED' });

            return {
                status: 'FAILED' as any,
                error: {
                    code: 'SCENE_RENDER_ERROR',
                    message: error.message
                }
            };
        }
    }

    private async composite(bgUrl: string, elements: CompositionElement[], hash: string): Promise<string> {
        const tmpDir = os.tmpdir();
        const outputPath = path.join(tmpDir, `scene_${hash}.png`);

        // Convert URLs to local paths if file://
        const getPath = (url: string) => url.startsWith('file://') ? url.replace('file://', '') : url;

        const bgPath = getPath(bgUrl);
        // Ensure BG exists (basic check)
        if (!fs.existsSync(bgPath) && bgUrl.startsWith('file://')) {
            throw new Error(`Background file not found: ${bgPath}`);
        }

        // Build Inputs
        // -i bg -i el1 -i el2 ...
        const inputs = [`-i "${bgPath}"`];
        const filterChains: string[] = [];

        // For each element, add input and filter
        // We start with [0:v] as base. 
        // Then overlay [1:v], result -> tmp1
        // Then tmp1 overlay [2:v] -> tmp2 ...
        // Simplest: 
        // [0:v][1:v] overlay=x=X:y=Y [v1];
        // [v1][2:v] overlay=x=X:y=Y [v2];

        let lastLabel = '0:v';

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const elPath = getPath(el.url);
            inputs.push(`-i "${elPath}"`);

            const inputIdx = i + 1; // 0 is bg
            const nextLabel = `v${inputIdx}`;

            // Basic overlay. Scaling would require scale filter first.
            // For MVP P2.2, let's assume pre-scaled or just basic overlay.
            // If scale is needed: [1:v] scale=W:H [scaled1]; [base][scaled1] overlay...
            // We'll skip scale for now to keep it simple unless strictly requested. 
            // The Task says "x,y,scale".
            // Let's implement scale if present.

            let sourceLabel = `[${inputIdx}:v]`;
            let scaleFilter = '';

            if (el.scale && el.scale !== 1) {
                const scaledLabel = `s${inputIdx}`;
                // scale=iw*SCALE:ih*SCALE
                scaleFilter = `[${inputIdx}:v]scale=iw*${el.scale}:ih*${el.scale}[${scaledLabel}];`;
                sourceLabel = `[${scaledLabel}]`;
            }

            const x = el.x || 0;
            const y = el.y || 0;

            // If it's the last one, we don't need a label for output, it implicitly flows to -map?
            // Actually explicit labels are safer.
            const outLabel = (i === elements.length - 1) ? '' : `[${nextLabel}]`;

            // Construct chain
            // If we have scale: "scaleString [last][scaled] overlay... [out]"
            // If no scale: "[last][idx] overlay... [out]"

            if (scaleFilter) {
                filterChains.push(`${scaleFilter}[${lastLabel}]${sourceLabel}overlay=${x}:${y}${outLabel}`);
            } else {
                filterChains.push(`[${lastLabel}]${sourceLabel}overlay=${x}:${y}${outLabel}`);
            }

            if (outLabel) {
                lastLabel = nextLabel; // Use the named label for next iteration
            }
        }

        const inputStr = inputs.join(' ');
        const filterStr = filterChains.length > 0 ? `-filter_complex "${filterChains.join(';')}"` : '';

        const cmd = `ffmpeg -y ${inputStr} ${filterStr} "${outputPath}"`;

        this.logger.log(`Executing FFmpeg: ${cmd}`);
        try {
            await execAsync(cmd);
        } catch (e: any) {
            throw new Error(`FFmpeg Execution Failed: ${e.stderr || e.message}`);
        }

        return `file://${outputPath}`;
    }

    private async auditHelper(input: EngineInvokeInput, type: 'HIT' | 'MISS', resourceId: string, extraDetails: any = {}) {
        await this.auditService.log({
            action: 'SCENE_COMPOSITION',
            resourceId: resourceId,
            resourceType: 'scene',
            details: {
                projectId: input.context.projectId,
                userId: input.context.userId || 'system',
                cache: type,
                traceId: input.context.traceId,
                ...extraDetails
            }
        });
    }

    private async recordCost(input: EngineInvokeInput, amount: number, extraDetails: any = {}) {
        await this.costLedgerService.recordFromEvent({
            userId: input.context.userId || 'system',
            projectId: input.context.projectId || '',
            jobId: input.context.jobId,
            jobType: input.jobType || 'SCENE_COMPOSITION',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: (input.context as any).attempt || 1,
            metadata: {
                type: 'scene_composition',
                traceId: input.context.traceId || 'unknown',
                ...extraDetails
            }
        });
    }
}
