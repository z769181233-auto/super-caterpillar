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
var CharacterGenAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterGenAdapter = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
let CharacterGenAdapter = CharacterGenAdapter_1 = class CharacterGenAdapter {
    redisService;
    auditService;
    costLedgerService;
    name = 'character_gen';
    logger = new common_1.Logger(CharacterGenAdapter_1.name);
    constructor(redisService, auditService, costLedgerService) {
        this.redisService = redisService;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'character_gen';
    }
    async invoke(input) {
        const payload = input.payload || {};
        const prompt = payload.prompt || '';
        const style = payload.style || 'default';
        const view = payload.view || 'front';
        const seed = payload.seed || 0;
        const provider = process.env.CHARACTER_GEN_PROVIDER || 'stub';
        const inputStr = `${prompt}:${style}:${view}:${seed}`;
        const inputHash = (0, crypto_1.createHash)('sha256').update(inputStr).digest('hex');
        const cacheKey = `char_gen:v1:${inputHash}`;
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
                        meta: { inputHash, provider, cached: true },
                    },
                };
            }
        }
        catch (e) {
            this.logger.warn(`Cache check failed: ${e}`);
        }
        try {
            let assetUrl = '';
            if (provider !== 'stub') {
                const apiKey = process.env.REPLICATE_API_TOKEN || process.env.COMFY_API_URL;
                if (!apiKey) {
                    throw new Error('PROVIDER_NO_KEY: Missing API Token/URL');
                }
                assetUrl = await this.generateDeterministicStub(inputHash);
            }
            else {
                assetUrl = await this.generateDeterministicStub(inputHash);
            }
            const output = {
                url: assetUrl,
                status: 'success',
                view,
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
            this.logger.error(`[CharacterGen] Failed: ${error.message}`);
            await this.auditHelper(input, 'MISS', 'failed_request', {
                status: 'FAILED',
                error: error.message,
            });
            await this.recordCost(input, 0, { status: 'FAILED' });
            return {
                status: 'FAILED',
                error: {
                    code: error.message.includes('NO_KEY') ? 'CHAR_NO_KEY' : 'CHAR_ERROR',
                    message: error.message,
                },
            };
        }
    }
    async generateDeterministicStub(hash) {
        const tmpDir = os.tmpdir();
        const fname = `char_${hash}.png`;
        const fpath = path.join(tmpDir, fname);
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        fs.writeFileSync(fpath, Buffer.from(base64, 'base64'));
        return `file://${fpath}`;
    }
    async auditHelper(input, type, resourceId, extraDetails = {}) {
        await this.auditService.log({
            action: 'CHARACTER_GEN',
            resourceId: resourceId,
            resourceType: 'character_gen',
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
            jobType: input.jobType || 'CHARACTER_GEN',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: {
                type: 'character_gen',
                traceId: input.context.traceId || 'unknown',
                ...extraDetails,
            },
        });
    }
};
exports.CharacterGenAdapter = CharacterGenAdapter;
exports.CharacterGenAdapter = CharacterGenAdapter = CharacterGenAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], CharacterGenAdapter);
//# sourceMappingURL=character_gen.adapter.js.map