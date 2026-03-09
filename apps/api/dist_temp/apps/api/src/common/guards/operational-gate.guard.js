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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationalGateGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let OperationalGateGuard = class OperationalGateGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const orgId = (request.headers['x-scu-org-id'] || request.headers['x-org-id']);
        const url = request.originalUrl || request.url;
        if (url.includes('/ce-dag/run') || url.includes('/v3/story/parse')) {
            const offlineEngines = await this.prisma.engine.findMany({
                where: { enabled: false },
                select: { engineKey: true },
            });
            if (offlineEngines.length > 0) {
                const isCriticalOffline = offlineEngines.some((e) => [
                    'character_visual',
                    'default_novel_analysis',
                    'default_shot_render',
                    'real_shot_render',
                ].includes(e.engineKey));
                if (isCriticalOffline) {
                    throw new common_1.ServiceUnavailableException({
                        error_code: 'ERR_ENGINE_OFFLINE',
                        message: 'Critical engine is offline. Generation suspended.',
                    });
                }
            }
        }
        if (orgId) {
            if (orgId.includes('blocked_')) {
                throw new common_1.ForbiddenException({
                    error_code: 'ERR_FEATURE_DISABLED',
                    message: 'This feature is disabled for your organization.',
                });
            }
            const org = await this.prisma.organization.findUnique({
                where: { id: orgId },
                select: { type: true },
            });
            if (org?.type === 'LIMITED_ACCESS') {
                throw new common_1.ForbiddenException({
                    error_code: 'ERR_LIMITED_ACCESS',
                    message: 'Access restricted for this organization type.',
                });
            }
        }
        return true;
    }
};
exports.OperationalGateGuard = OperationalGateGuard;
exports.OperationalGateGuard = OperationalGateGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OperationalGateGuard);
//# sourceMappingURL=operational-gate.guard.js.map