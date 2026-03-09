"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ShotPreviewFastAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotPreviewFastAdapter = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../redis/redis.service");
const shot_render_router_adapter_1 = require("./shot_render_router.adapter");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
let ShotPreviewFastAdapter = ShotPreviewFastAdapter_1 = class ShotPreviewFastAdapter {
    redisService;
    shotRenderRouter;
    auditService;
    costLedgerService;
    name = 'shot_preview';
    logger = new common_1.Logger(ShotPreviewFastAdapter_1.name);
    constructor(redisService, shotRenderRouter, auditService, costLedgerService) {
        this.redisService = redisService;
        this.shotRenderRouter = shotRenderRouter;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'shot_preview';
    }
    async invoke(input) {
        try {
            const payload = input.payload || {};
            const prompt = payload.enrichedPrompt || payload.prompt || '';
            const seed = payload.seed || 0;
            const style = payload.style || 'default';
            const width = 256;
            const height = 256;
            const steps = 10;
            const keyContent = `${prompt}:${seed}:${style}:${width}:${height}:${steps}`;
            const promptHash = (0, crypto_1.createHash)('sha256').update(keyContent).digest('hex');
            const cacheKey = `preview:v1:${promptHash}`;
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                await this.auditPreview(input, 'HIT', cacheKey);
                await this.recordCost(input, 0);
                return {
                    status: 'SUCCESS',
                    output: {
                        ...cached,
                        source: 'cache',
                        preview: true,
                    },
                };
            }
            this.logger.log(`[ShotPreview] Cache MISS for ${cacheKey}. Rendering...`);
            const previewInput = {
                ...input,
                payload: {
                    ...payload,
                    width,
                    height,
                    steps,
                    preview: true,
                    quality: 'preview',
                },
            };
            const result = await this.shotRenderRouter.invoke(previewInput);
            if (String(result.status) === 'SUCCESS' && result.output) {
                const output = result.output;
                const url = output.url || output.assetUrl || '';
                if (url.includes('http://mock') || url.includes('https://mock')) {
                    throw new Error(`REAL_MODE_VIOLATION: Generated URL contains mock domain: ${url}`);
                }
                if (!url.startsWith('http') && !url.startsWith('file://')) {
                    throw new Error(`REAL_MODE_VIOLATION: Generated URL invalid schema: ${url}`);
                }
                await this.redisService.setJson(cacheKey, result.output, 7 * 24 * 3600);
                await this.auditPreview(input, 'MISS', cacheKey);
                await this.recordCost(input, 1);
            }
            return {
                ...result,
                output: {
                    ...result.output,
                    source: 'render',
                    preview: true,
                },
            };
        }
        catch (error) {
            this.logger.error(`[ShotPreview] Failed: ${error.message}`);
            await this.auditPreview(input, 'MISS', 'failed_request', {
                status: 'FAILED',
                error: error.message,
            });
            await this.recordCost(input, 0, { status: 'FAILED' });
            return {
                status: 'FAILED',
                error: {
                    code: 'PREVIEW_FAIL',
                    message: error.message,
                },
            };
        }
    }
    async auditPreview(input, type, cacheKey, extraDetails = {}) {
        try {
            await this.auditService.log({
                action: 'SHOT_PREVIEW',
                resourceId: cacheKey,
                resourceType: 'preview',
                details: {
                    projectId: input.context.projectId || '',
                    userId: input.context.userId || 'system',
                    cache: type,
                    engine: this.name,
                    traceId: input.context.traceId,
                    ...extraDetails,
                },
            });
        }
        catch (e) {
            this.logger.warn(`Audit failed: ${e}`);
        }
    }
    async recordCost(input, amount, extraDetails = {}) {
        try {
            await this.costLedgerService.recordFromEvent({
                userId: input.context.userId || 'system',
                projectId: input.context.projectId || '',
                jobId: input.context.jobId,
                jobType: input.jobType || 'SHOT_PREVIEW',
                engineKey: this.name,
                costAmount: amount,
                billingUnit: 'job',
                quantity: 1,
                attempt: input.context.attempt || 1,
                metadata: {
                    type: 'preview',
                    traceId: input.context.traceId || 'unknown',
                    ...extraDetails,
                },
            });
        }
        catch (e) {
            this.logger.warn(`Cost record failed: ${e}`);
        }
    }
};
exports.ShotPreviewFastAdapter = ShotPreviewFastAdapter;
exports.ShotPreviewFastAdapter = ShotPreviewFastAdapter = ShotPreviewFastAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        shot_render_router_adapter_1.ShotRenderRouterAdapter,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], ShotPreviewFastAdapter);
//# sourceMappingURL=shot_preview.fast.adapter.js.map