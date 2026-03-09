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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TextSafetyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextSafetyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const feature_flag_service_1 = require("../feature-flag/feature-flag.service");
const crypto_1 = require("crypto");
const text_safety_metrics_1 = require("../observability/text_safety.metrics");
let TextSafetyService = class TextSafetyService {
    static { TextSafetyService_1 = this; }
    prisma;
    auditLogService;
    featureFlagService;
    logger = new common_1.Logger(TextSafetyService_1.name);
    BLACKLIST_KEYWORDS = [
        'violation',
        'prohibited',
        'illegal',
        'spam',
        'malware',
        'virus',
        'hacked',
    ];
    GREYLIST_PATTERNS = [
        /微信[号id:：]?\s*[\w-]+/gi,
        /QQ[号id:：]?\s*\d{5,}/gi,
        /手机[号]?[：:]?\s*1[3-9]\d{9}/gi,
        /[\w-.]+@[\w-]+\.\w+/gi,
        /加我|私信|联系我|咨询我/gi,
    ];
    constructor(prisma, auditLogService, featureFlagService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.featureFlagService = featureFlagService;
    }
    async sanitize(inputText, context) {
        const start = Date.now();
        try {
            const triStateEnabled = this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE');
            if (!triStateEnabled) {
                const sanitizedText = this.removePlaceholders(inputText);
                text_safety_metrics_1.TextSafetyMetrics.recordDecision('PASS');
                text_safety_metrics_1.TextSafetyMetrics.recordLatency(Date.now() - start);
                return {
                    decision: 'PASS',
                    riskLevel: 'low',
                    sanitizedText,
                    sanitizedDigest: this.sha256(sanitizedText),
                    flags: sanitizedText !== inputText ? ['PLACEHOLDER_REMOVED'] : [],
                    reasons: [],
                    traceId: context.traceId,
                };
            }
            const flags = [];
            const reasons = [];
            let decision = 'PASS';
            let riskLevel = 'low';
            const blacklistMatches = this.checkBlacklist(inputText);
            if (blacklistMatches.length > 0) {
                decision = 'BLOCK';
                riskLevel = 'critical';
                flags.push('BLACKLIST_MATCH');
                reasons.push(...blacklistMatches.map((kw) => `含违禁词: ${kw}`));
            }
            if (decision !== 'BLOCK') {
                const greylistMatches = this.checkGreylist(inputText);
                if (greylistMatches.length > 0) {
                    decision = 'WARN';
                    riskLevel = 'medium';
                    flags.push('GREYLIST_MATCH');
                    reasons.push(...greylistMatches.map((m) => `含灰名单内容: ${m}`));
                }
            }
            const sanitizedText = this.removePlaceholders(inputText);
            if (sanitizedText !== inputText && decision === 'PASS') {
                flags.push('PLACEHOLDER_REMOVED');
            }
            const sanitizedDigest = this.sha256(sanitizedText);
            const outcome = {
                decision,
                riskLevel,
                sanitizedText,
                sanitizedDigest,
                flags,
                reasons,
                traceId: context.traceId,
            };
            if (context.resourceType && context.resourceId) {
                try {
                    await this.prisma.textSafetyResult.create({
                        data: {
                            resourceType: context.resourceType,
                            resourceId: context.resourceId,
                            decision,
                            riskLevel,
                            flags,
                            reasons,
                            sanitizedDigest,
                            traceId: context.traceId,
                        },
                    });
                }
                catch (error) {
                    this.logger.error('Failed to save TextSafetyResult', error);
                }
            }
            const action = decision === 'PASS'
                ? 'TEXT_SAFETY_PASS'
                : decision === 'WARN'
                    ? 'TEXT_SAFETY_WARN'
                    : 'TEXT_SAFETY_BLOCK';
            await this.auditLogService.record({
                userId: context.userId,
                apiKeyId: context.apiKeyId,
                orgId: context.orgId,
                action,
                resourceType: context.resourceType || 'text',
                resourceId: context.resourceId || context.projectId,
                ip: context.ip,
                userAgent: context.userAgent,
                details: {
                    decision,
                    riskLevel,
                    flags,
                    reasons,
                    digest: sanitizedDigest.substring(0, 16),
                    traceId: context.traceId,
                },
            });
            this.logger.log(`Text safety check: decision=${decision} riskLevel=${riskLevel} flags=${flags.join(',')}`);
            text_safety_metrics_1.TextSafetyMetrics.recordDecision(decision);
            text_safety_metrics_1.TextSafetyMetrics.recordLatency(Date.now() - start);
            return outcome;
        }
        catch (error) {
            this.logger.error(`TextSafetyService.sanitize FAILED, fallback to PASS. Error: ${error.message}`, error.stack);
            try {
                await this.auditLogService.record({
                    userId: context.userId,
                    action: 'TEXT_SAFETY_FAILSAFE',
                    resourceType: 'text',
                    resourceId: context.resourceId || 'unknown',
                    details: { error: error.message },
                });
            }
            catch (e) {
            }
            text_safety_metrics_1.TextSafetyMetrics.recordDecision('PASS');
            text_safety_metrics_1.TextSafetyMetrics.recordLatency(Date.now() - start);
            return {
                decision: 'PASS',
                riskLevel: 'low',
                sanitizedText: inputText,
                sanitizedDigest: 'FAILSAFE',
                flags: ['FAILSAFE_TRIGGERED'],
                reasons: ['Internal error during sanitization'],
                traceId: context.traceId,
            };
        }
    }
    checkBlacklist(text) {
        const matches = [];
        const lowerText = text.toLowerCase();
        for (const keyword of this.BLACKLIST_KEYWORDS) {
            if (lowerText.includes(keyword.toLowerCase())) {
                matches.push(keyword);
            }
        }
        return matches;
    }
    checkGreylist(text) {
        const matches = [];
        for (const pattern of this.GREYLIST_PATTERNS) {
            const found = text.match(pattern);
            if (found && found.length > 0) {
                matches.push(found[0].substring(0, 20));
            }
        }
        return matches;
    }
    removePlaceholders(text) {
        const placeholders = [/\[待填充\]/g, /\[TODO\]/g, /\[占位\]/g, /\[placeholder\]/gi];
        let sanitized = text;
        for (const pattern of placeholders) {
            sanitized = sanitized.replace(pattern, '');
        }
        return sanitized.trim();
    }
    sha256(text) {
        return (0, crypto_1.createHash)('sha256').update(text, 'utf8').digest('hex');
    }
    static TEST_BLACKLIST_KEYWORD = 'violation';
    static TEST_GREYLIST_PATTERN = '微信号test123';
};
exports.TextSafetyService = TextSafetyService;
exports.TextSafetyService = TextSafetyService = TextSafetyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(2, (0, common_1.Inject)(feature_flag_service_1.FeatureFlagService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        feature_flag_service_1.FeatureFlagService])
], TextSafetyService);
//# sourceMappingURL=text-safety.service.js.map