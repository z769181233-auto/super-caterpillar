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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectResolver = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProjectResolver = class ProjectResolver {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveProjectAuthOnly(episode) {
        if (!episode)
            return null;
        const seasonProject = episode.season?.project;
        if (seasonProject?.id && seasonProject?.organizationId && seasonProject?.ownerId) {
            return {
                id: seasonProject.id,
                organizationId: seasonProject.organizationId,
                ownerId: seasonProject.ownerId,
            };
        }
        const projectId = episode.projectId;
        if (!projectId)
            return null;
        return this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, organizationId: true, ownerId: true },
        });
    }
    async resolveProjectNeedSettings(episode) {
        if (!episode)
            return null;
        const seasonProject = episode.season?.project;
        if (seasonProject?.id &&
            seasonProject?.organizationId &&
            seasonProject?.settingsJson !== undefined) {
            return {
                id: seasonProject.id,
                organizationId: seasonProject.organizationId,
                settingsJson: seasonProject.settingsJson,
                name: seasonProject.name ?? null,
            };
        }
        const projectId = episode.projectId;
        if (!projectId)
            return null;
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                organizationId: true,
                settingsJson: true,
                name: true,
            },
        });
        if (!project)
            return null;
        return {
            id: project.id,
            organizationId: project.organizationId,
            settingsJson: project.settingsJson,
            name: project.name,
        };
    }
};
exports.ProjectResolver = ProjectResolver;
exports.ProjectResolver = ProjectResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProjectResolver);
//# sourceMappingURL=project-resolver.js.map