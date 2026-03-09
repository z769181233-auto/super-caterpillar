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
exports.JobAuthOpsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const project_resolver_1 = require("../common/project-resolver");
const job_service_queries_1 = require("./job.service.queries");
let JobAuthOpsService = class JobAuthOpsService {
    prisma;
    projectResolver;
    constructor(prisma, projectResolver) {
        this.prisma = prisma;
        this.projectResolver = projectResolver;
    }
    async checkShotOwnership(shotId, organizationId) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: job_service_queries_1.SHOT_WITH_HIERARCHY,
        });
        if (!shot) {
            throw new common_1.NotFoundException('Shot not found');
        }
        const scene = shot.scene;
        let shotProject = await this.projectResolver.resolveProjectAuthOnly(scene?.episode);
        if (!shotProject && scene?.projectId) {
            shotProject = await this.prisma.project.findUnique({
                where: { id: scene.projectId },
            });
        }
        if (!shotProject) {
            throw new common_1.NotFoundException(`Project not found for shot ${shotId}`);
        }
        if (shotProject.organizationId !== organizationId) {
            throw new common_1.ForbiddenException('You do not have permission to access this shot');
        }
        return shot;
    }
};
exports.JobAuthOpsService = JobAuthOpsService;
exports.JobAuthOpsService = JobAuthOpsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => project_resolver_1.ProjectResolver))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_resolver_1.ProjectResolver])
], JobAuthOpsService);
//# sourceMappingURL=job-auth-ops.service.js.map