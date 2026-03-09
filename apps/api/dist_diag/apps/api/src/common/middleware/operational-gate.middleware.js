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
exports.OperationalGateMiddleware = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let OperationalGateMiddleware = class OperationalGateMiddleware {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async use(req, res, next) {
        const orgId = (req.headers['x-scu-org-id'] || req.headers['x-org-id']);
        const url = req.originalUrl || req.url;
        if (process.env.DEBUG_OP_GATE === 'true') {
            console.log(`[OpGate] Path: ${url}, Org: ${orgId}`);
        }
        if (url.includes('/ce-dag/run') || url.includes('/v3/story/parse')) {
            const offlineEngines = await this.prisma.engine.findMany({
                where: { enabled: false },
                select: { engineKey: true },
            });
            if (offlineEngines.length > 0) {
                const isCriticalOffline = offlineEngines.some((e) => ['character_visual', 'story_parse'].includes(e.engineKey));
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
        return next();
    }
};
exports.OperationalGateMiddleware = OperationalGateMiddleware;
exports.OperationalGateMiddleware = OperationalGateMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OperationalGateMiddleware);
//# sourceMappingURL=operational-gate.middleware.js.map