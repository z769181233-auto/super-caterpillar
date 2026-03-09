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
var FeatureFlagService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let FeatureFlagService = FeatureFlagService_1 = class FeatureFlagService {
    prisma;
    logger = new common_1.Logger(FeatureFlagService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    isEnabled(flagName, context) {
        const envValue = process.env[flagName];
        const isGlobalEnabled = ['true', '1', 'yes'].includes((envValue || '').toLowerCase());
        if (isGlobalEnabled) {
            this.logger.debug(`Feature flag ${flagName} GLOBALLY ENABLED`);
            return true;
        }
        if (!context) {
            return false;
        }
        if (context.orgId) {
            const orgWhitelist = process.env[`${flagName}_ORG_WHITELIST`];
            if (orgWhitelist) {
                const allowed = orgWhitelist
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (allowed.includes(context.orgId)) {
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Org Whitelist for ${context.orgId}`);
                    return true;
                }
            }
        }
        if (context.projectId) {
            const projectWhitelist = process.env[`${flagName}_PROJECT_WHITELIST`];
            if (projectWhitelist) {
                const allowed = projectWhitelist
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (allowed.includes(context.projectId)) {
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Project Whitelist for ${context.projectId}`);
                    return true;
                }
            }
        }
        const percentageStr = process.env[`${flagName}_PERCENTAGE`];
        if (percentageStr && context.userId) {
            const percentage = parseInt(percentageStr, 10);
            if (!isNaN(percentage)) {
                if (percentage <= 0)
                    return false;
                if (percentage >= 100) {
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Percentage (>=100%)`);
                    return true;
                }
                const hash = this.simpleHash(context.userId);
                if (hash % 100 < percentage) {
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Percentage (${percentage}%) for ${context.userId}`);
                    return true;
                }
            }
        }
        return false;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    async isAutoReworkEnabled(context) {
        const envValue = process.env['FEATURE_AUTO_REWORK_ENABLED'];
        if (envValue) {
            const isEnvEnabled = ['true', '1', 'yes'].includes(envValue.toLowerCase());
            if (isEnvEnabled)
                return true;
        }
        if (context.projectId) {
            try {
                const project = await this.prisma.project.findUnique({
                    where: { id: context.projectId },
                    select: { settingsJson: true },
                });
                const settings = project?.settingsJson;
                if (settings?.autoReworkEnabled === true ||
                    settings?.ce23RealEnabled === true ||
                    settings?.ce23RealShadowEnabled === true) {
                    this.logger.debug(`Feature flag AUTO_REWORK/CE23 enabled via DB for project ${context.projectId}`);
                    return true;
                }
            }
            catch (e) {
                this.logger.error(`Failed to check project feature flag: ${e.message}`);
            }
        }
        return false;
    }
    getAllFlags() {
        const knownFlags = [
            'FEATURE_SIGNED_URL_ENFORCED',
            'FEATURE_TEXT_SAFETY_TRI_STATE',
            'FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT',
            'FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE',
            'FEATURE_AUTO_REWORK_ENABLED',
        ];
        const flags = {};
        for (const flagName of knownFlags) {
            flags[flagName] = this.isEnabled(flagName);
        }
        return flags;
    }
};
exports.FeatureFlagService = FeatureFlagService;
exports.FeatureFlagService = FeatureFlagService = FeatureFlagService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FeatureFlagService);
//# sourceMappingURL=feature-flag.service.js.map