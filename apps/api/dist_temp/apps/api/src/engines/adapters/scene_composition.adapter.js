"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SceneCompositionAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneCompositionAdapter = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const engines_scene_composition_1 = require("@scu/engines-scene-composition");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let SceneCompositionAdapter = SceneCompositionAdapter_1 = class SceneCompositionAdapter {
    redisService;
    auditService;
    costLedgerService;
    name = 'scene_composition';
    logger = new common_1.Logger(SceneCompositionAdapter_1.name);
    constructor(redisService, auditService, costLedgerService) {
        this.redisService = redisService;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'scene_composition';
    }
    async invoke(input) {
        const payload = input.payload || {};
        const bgUrl = payload.background_url || '';
        const elements = payload.elements || [];
        if (!bgUrl) {
            return {
                status: 'FAILED',
                error: { code: 'SCENE_NO_BG', message: 'Missing background_url' },
            };
        }
        const inputStr = JSON.stringify({ bgUrl, elements });
        const inputHash = (0, crypto_1.createHash)('sha256').update(inputStr).digest('hex');
        const cacheKey = `scene_comp:v2:${inputHash}`;
        try {
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                await this.auditHelper(input, 'HIT', cacheKey);
                await this.recordCost(input, 0, { cached: true });
                return {
                    status: 'SUCCESS',
                    output: {
                        ...cached,
                        source: 'cache',
                        meta: { inputHash, cached: true },
                    },
                };
            }
        }
        catch (e) {
            this.logger.warn(`Cache check failed: ${e}`);
        }
        try {
            const aiResult = await engines_scene_composition_1.sceneCompositionRealEngine.run({
                scene_description: payload.scene_description || payload.text || 'Normal composition',
                background_url: bgUrl,
                elements: elements,
            });
            const outputUrl = await this.composite(bgUrl, aiResult.elements, inputHash);
            const output = {
                url: outputUrl,
                status: 'success',
                layers: elements.length + 1,
                composition_mode: aiResult.composition_mode,
                ai_description: aiResult.description,
            };
            await this.redisService.setJson(cacheKey, output, 7 * 24 * 3600);
            await this.auditHelper(input, 'MISS', cacheKey);
            await this.recordCost(input, 1);
            return {
                status: 'SUCCESS',
                output: {
                    ...output,
                    source: 'render',
                    ai_audit: aiResult.audit_trail.engine_version,
                },
            };
        }
        catch (error) {
            this.logger.error(`[SceneComposition] Failed: ${error.message}`);
            await this.auditHelper(input, 'MISS', 'failed_request', {
                status: 'FAILED',
                error: error.message,
            });
            await this.recordCost(input, 0, { status: 'FAILED' });
            return {
                status: 'FAILED',
                error: {
                    code: 'SCENE_RENDER_ERROR',
                    message: error.message,
                },
            };
        }
    }
    async composite(bgUrl, elements, hash) {
        const tmpDir = os.tmpdir();
        const outputPath = path.join(tmpDir, `scene_${hash}.png`);
        const getPath = (url) => (url.startsWith('file://') ? url.replace('file://', '') : url);
        const bgPath = getPath(bgUrl);
        if (!fs.existsSync(bgPath) && bgUrl.startsWith('file://')) {
            throw new Error(`Background file not found: ${bgPath}`);
        }
        const inputs = [`-i "${bgPath}"`];
        const filterChains = [];
        let lastLabel = '0:v';
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const elPath = getPath(el.url);
            inputs.push(`-i "${elPath}"`);
            const inputIdx = i + 1;
            const nextLabel = `v${inputIdx}`;
            let sourceLabel = `[${inputIdx}:v]`;
            let scaleFilter = '';
            if (el.scale && el.scale !== 1) {
                const scaledLabel = `s${inputIdx}`;
                scaleFilter = `[${inputIdx}:v]scale=iw*${el.scale}:ih*${el.scale}[${scaledLabel}];`;
                sourceLabel = `[${scaledLabel}]`;
            }
            const x = el.x || 0;
            const y = el.y || 0;
            const outLabel = i === elements.length - 1 ? '' : `[${nextLabel}]`;
            if (scaleFilter) {
                filterChains.push(`${scaleFilter}[${lastLabel}]${sourceLabel}overlay=${x}:${y}${outLabel}`);
            }
            else {
                filterChains.push(`[${lastLabel}]${sourceLabel}overlay=${x}:${y}${outLabel}`);
            }
            if (outLabel) {
                lastLabel = nextLabel;
            }
        }
        const inputStr = inputs.join(' ');
        const filterStr = filterChains.length > 0 ? `-filter_complex "${filterChains.join(';')}"` : '';
        const cmd = `ffmpeg -y ${inputStr} ${filterStr} "${outputPath}"`;
        this.logger.log(`Executing FFmpeg: ${cmd}`);
        try {
            await execAsync(cmd);
        }
        catch (e) {
            throw new Error(`FFmpeg Execution Failed: ${e.stderr || e.message}`);
        }
        return `file://${outputPath}`;
    }
    async auditHelper(input, type, resourceId, extraDetails = {}) {
        await this.auditService.log({
            action: 'SCENE_COMPOSITION',
            resourceId: resourceId,
            resourceType: 'scene',
            details: {
                projectId: input.context.projectId,
                userId: input.context.userId || 'system',
                cache: type,
                traceId: input.context.traceId,
                ...extraDetails,
            },
        });
    }
    async recordCost(input, amount, extraDetails = {}) {
        await this.costLedgerService.recordFromEvent({
            userId: input.context.userId || 'system',
            projectId: input.context.projectId || '',
            jobId: input.context.jobId,
            jobType: input.jobType || 'SCENE_COMPOSITION',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: {
                type: 'scene_composition',
                traceId: input.context.traceId || 'unknown',
                ...extraDetails,
            },
        });
    }
};
exports.SceneCompositionAdapter = SceneCompositionAdapter;
exports.SceneCompositionAdapter = SceneCompositionAdapter = SceneCompositionAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], SceneCompositionAdapter);
//# sourceMappingURL=scene_composition.adapter.js.map