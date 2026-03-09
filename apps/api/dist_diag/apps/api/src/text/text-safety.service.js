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
var TextSafetyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextSafetyService = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const audit_constants_1 = require("../audit/audit.constants");
let TextSafetyService = TextSafetyService_1 = class TextSafetyService {
    auditLogService;
    logger = new common_1.Logger(TextSafetyService_1.name);
    BLACKLIST_KEYWORDS = [
        '暴力',
        '色情',
        '政治敏感',
    ];
    constructor(auditLogService) {
        this.auditLogService = auditLogService;
    }
    async sanitize(text, userId, ip, userAgent) {
        const flags = [];
        let sanitizedText = text;
        const lowerText = text.toLowerCase();
        for (const keyword of this.BLACKLIST_KEYWORDS) {
            if (lowerText.includes(keyword.toLowerCase())) {
                flags.push(`BLACKLIST_KEYWORD:${keyword}`);
                sanitizedText = sanitizedText.replace(new RegExp(keyword, 'gi'), '[已过滤]');
            }
        }
        const passed = flags.length === 0;
        await this.auditLogService.record({
            userId,
            action: audit_constants_1.AuditActions.SAFETY_CHECK,
            resourceType: 'text',
            resourceId: undefined,
            ip,
            userAgent,
            details: {
                passed,
                flags,
                originalText: text,
                sanitizedText,
                timestamp: new Date().toISOString(),
            },
        });
        if (!passed) {
            this.logger.warn(`Text safety check failed: flags=${flags.join(', ')}`);
        }
        return {
            passed,
            sanitizedText,
            flags,
        };
    }
};
exports.TextSafetyService = TextSafetyService;
exports.TextSafetyService = TextSafetyService = TextSafetyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], TextSafetyService);
//# sourceMappingURL=text-safety.service.js.map