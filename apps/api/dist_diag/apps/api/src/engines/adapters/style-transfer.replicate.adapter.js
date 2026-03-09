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
var StyleTransferReplicateAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StyleTransferReplicateAdapter = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
let StyleTransferReplicateAdapter = StyleTransferReplicateAdapter_1 = class StyleTransferReplicateAdapter {
    redisService;
    auditService;
    costLedgerService;
    name = 'style_transfer';
    logger = new common_1.Logger(StyleTransferReplicateAdapter_1.name);
    constructor(redisService, auditService, costLedgerService) {
        this.redisService = redisService;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'style_transfer';
    }
    async invoke(input) {
        const t0 = Date.now();
        const payload = input.payload || {};
        const style = payload.style || 'unspecified';
        const sourceUrl = payload.image_url || payload.source_url || '';
        const provider = process.env.STYLE_TRANSFER_PROVIDER || 'stub';
        const inputStr = `${style}:${sourceUrl}`;
        const inputHash = (0, crypto_1.createHash)('sha256').update(inputStr).digest('hex');
        const cacheKey = `style_trans:v1:${inputHash}`;
        try {
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                await this.auditHelper(input, 'HIT', cacheKey, { provider });
                await this.recordCost(input, 0, { cached: true });
                return {
                    status: 'SUCCESS',
                    output: {
                        ...cached,
                        source: 'cache',
                        meta: { style, provider, cached: true },
                    },
                };
            }
        }
        catch (e) {
            this.logger.warn(`Cache check failed: ${e}`);
        }
        try {
            let assetUrl = '';
            if (provider === 'replicate') {
                const apiKey = process.env.REPLICATE_API_TOKEN;
                if (!apiKey) {
                    throw new Error('REPLICATE_NO_KEY: Missing REPLICATE_API_TOKEN');
                }
                assetUrl = await this.generateStubFile(style);
            }
            else {
                assetUrl = await this.generateStubFile(style);
            }
            const output = {
                url: assetUrl,
                status: 'success',
                style,
                provider,
            };
            await this.redisService.setJson(cacheKey, output, 7 * 24 * 3600);
            await this.auditHelper(input, 'MISS', cacheKey, { provider });
            await this.recordCost(input, 1, { provider });
            return {
                status: 'SUCCESS',
                output: {
                    ...output,
                    source: 'render',
                },
            };
        }
        catch (error) {
            this.logger.error(`[StyleTransfer] Failed: ${error.message}`);
            await this.auditHelper(input, 'MISS', 'failed_request', {
                status: 'FAILED',
                error: error.message,
            });
            await this.recordCost(input, 0, { status: 'FAILED' });
            return {
                status: 'FAILED',
                error: {
                    code: error.message.includes('NO_KEY') ? 'STYLE_NO_KEY' : 'STYLE_ERROR',
                    message: error.message,
                },
            };
        }
    }
    async generateStubFile(style) {
        const tmpDir = os.tmpdir();
        const fname = `style_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const fpath = path.join(tmpDir, fname);
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        fs.writeFileSync(fpath, Buffer.from(base64, 'base64'));
        return `file://${fpath}`;
    }
    async auditHelper(input, type, resourceId, extraDetails = {}) {
        await this.auditService.log({
            action: 'STYLE_TRANSFER',
            resourceId: resourceId,
            resourceType: 'style_transfer',
            details: {
                projectId: input.context.projectId || '',
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
            jobType: input.jobType || 'STYLE_TRANSFER',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: {
                type: 'style_transfer',
                traceId: input.context.traceId || 'unknown',
                ...extraDetails,
            },
        });
    }
};
exports.StyleTransferReplicateAdapter = StyleTransferReplicateAdapter;
exports.StyleTransferReplicateAdapter = StyleTransferReplicateAdapter = StyleTransferReplicateAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], StyleTransferReplicateAdapter);
//# sourceMappingURL=style-transfer.replicate.adapter.js.map