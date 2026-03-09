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
var TranslationCloudAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationCloudAdapter = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
let TranslationCloudAdapter = TranslationCloudAdapter_1 = class TranslationCloudAdapter {
    prisma;
    auditService;
    costLedgerService;
    name = 'translation_engine';
    logger = new common_1.Logger(TranslationCloudAdapter_1.name);
    constructor(prisma, auditService, costLedgerService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'translation_engine';
    }
    async invoke(input) {
        try {
            const payload = input.payload || {};
            const sourceText = payload.sourceText || '';
            const targetLang = payload.targetLang || 'en';
            const provider = payload.provider || process.env.TRANSLATION_PROVIDER || 'deepl';
            const sourceLang = payload.sourceLang || 'auto';
            if (!sourceText) {
                throw new Error('sourceText is required');
            }
            const inputHash = (0, crypto_1.createHash)('sha256').update(sourceText).digest('hex');
            const cached = await this.prisma.translationCache.findUnique({
                where: {
                    provider_target_hash_project: {
                        provider,
                        targetLang,
                        inputHash,
                        projectId: input.context.projectId || '',
                    },
                },
            });
            if (cached) {
                await this.auditHelper(input, 'HIT', `hash:${inputHash}`);
                await this.recordCost(input, 0);
                return {
                    status: 'SUCCESS',
                    output: {
                        text: cached.outputText,
                        source: 'cache',
                        meta: { provider, lang: targetLang },
                    },
                };
            }
            const apiKeyEnv = 'TRANSLATION_API_KEY';
            const apiKey = process.env[apiKeyEnv];
            if (!apiKey) {
                throw new Error(`TRANSLATION_NO_KEY: Missing environment variable ${apiKeyEnv}`);
            }
            const translatedText = await this.simulateTranslation(provider, sourceText, targetLang, apiKey);
            await this.prisma.translationCache.create({
                data: {
                    organizationId: input.context.organizationId,
                    projectId: input.context.projectId || '',
                    provider,
                    sourceLang,
                    targetLang,
                    inputHash,
                    outputText: translatedText,
                },
            });
            await this.auditHelper(input, 'MISS', `hash:${inputHash}`);
            await this.recordCost(input, 1);
            return {
                status: 'SUCCESS',
                output: {
                    text: translatedText,
                    source: 'provider',
                    meta: { provider, lang: targetLang },
                },
            };
        }
        catch (error) {
            this.logger.error(`[Translation] Failed: ${error.message}`);
            await this.auditHelper(input, 'MISS', 'failed_request', {
                status: 'FAILED',
                error: error.message,
            });
            await this.recordCost(input, 0, { status: 'FAILED' });
            return {
                status: 'FAILED',
                error: {
                    code: error.message.includes('NO_KEY') ? 'TRANSLATION_NO_KEY' : 'TRANSLATION_ERROR',
                    message: error.message,
                },
            };
        }
    }
    async simulateTranslation(provider, text, target, key) {
        return `[${provider}:${target}] ${text}`;
    }
    async auditHelper(input, type, resourceId, extraDetails = {}) {
        try {
            await this.auditService.log({
                action: 'TRANSLATION_INVOKE',
                resourceId: resourceId,
                resourceType: 'translation',
                details: {
                    projectId: input.context.projectId,
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
                jobType: input.jobType || 'TRANSLATION',
                engineKey: this.name,
                costAmount: amount,
                billingUnit: 'job',
                quantity: 1,
                attempt: input.context.attempt || 1,
                metadata: {
                    type: 'translation',
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
exports.TranslationCloudAdapter = TranslationCloudAdapter;
exports.TranslationCloudAdapter = TranslationCloudAdapter = TranslationCloudAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], TranslationCloudAdapter);
//# sourceMappingURL=translation.cloud.adapter.js.map