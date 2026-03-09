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
var PermissionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const permission_cache_1 = require("./permission.cache");
const permission_constants_1 = require("./permission.constants");
let PermissionService = PermissionService_1 = class PermissionService {
    prisma;
    cache;
    logger = new common_1.Logger(PermissionService_1.name);
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
        this.logger.log('[PermissionService] 构造成功，PrismaService 已注入');
    }
    async getUserPermissions(userId, contextOrgId) {
        const cacheKey = contextOrgId ? `${userId}:${contextOrgId}` : userId;
        const cached = await this.cache.getUserPerms(cacheKey);
        if (cached)
            return cached;
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return [];
        const roleNames = new Set();
        if (user.role && !contextOrgId) {
            roleNames.add(user.role);
        }
        const memberships = await this.prisma.organizationMember.findMany({
            where: {
                userId,
                ...(contextOrgId ? { organizationId: contextOrgId } : {}),
            },
        });
        memberships.forEach((m) => roleNames.add(m.role));
        const rolePerms = await this.prisma.rolePermission
            .findMany({
            where: {
                role: { name: { in: Array.from(roleNames) } },
            },
            include: { permission: true },
        })
            .catch(() => []);
        const perms = Array.from(new Set(rolePerms.map((rp) => rp.permission.key)));
        await this.cache.setUserPerms(cacheKey, perms);
        return perms;
    }
    async getProjectPermissions(projectId, userId) {
        const cached = await this.cache.getProjectPerms(projectId, userId);
        if (cached)
            return cached;
        const projectMember = await this.prisma.projectMember.findUnique({
            where: { userId_projectId: { userId, projectId } },
            include: { role: { include: { rolePerms: { include: { permission: true } } } } },
        });
        let perms = [];
        if (projectMember) {
            perms = projectMember.role.rolePerms.map((rp) => rp.permission.key);
        }
        await this.cache.setProjectPerms(projectId, userId, perms);
        return perms;
    }
    async hasPermissions(params) {
        const { userId, projectId, required } = params;
        let orgId;
        if (projectId) {
            const proj = await this.prisma.project.findUnique({
                where: { id: projectId },
                select: { organizationId: true },
            });
            orgId = proj?.organizationId || undefined;
        }
        if (process.env.DEBUG_PERM === '1' || process.env.NODE_ENV !== 'production') {
            const dbgMem = await this.prisma.organizationMember.findMany({
                where: { userId, ...(orgId ? { organizationId: orgId } : {}) },
            });
            this.logger.log(`[PERM_DIAG] User=${userId} ContextOrg=${orgId || 'N/A'}`);
            this.logger.log(`[PERM_DIAG] Memberships=${dbgMem.length} (${dbgMem.map((m) => m.organizationId + ':' + m.role).join(',')})`);
        }
        const sysPerms = await this.getUserPermissions(userId, orgId);
        const projPerms = projectId ? await this.getProjectPermissions(projectId, userId) : [];
        const allPerms = new Set([...sysPerms, ...projPerms]);
        if (process.env.DEBUG_PERM === '1' || process.env.NODE_ENV !== 'production') {
            this.logger.log(`[PERM_DIAG] SysPerms=${sysPerms.length} ProjPerms=${projPerms.length} Total=${allPerms.size}`);
            if (allPerms.size === 0) {
                this.logger.warn(`[PERM_DIAG] ZERO PERMISSIONS! checking reasons...`);
                const user = await this.prisma.user.findUnique({ where: { id: userId } });
                this.logger.log(`[PERM_DIAG] UserRole=${user?.role} UserType=${user?.userType}`);
            }
        }
        const isGranted = required.every((p) => allPerms.has(p));
        if (!isGranted) {
            this.logger.warn(`[PERM_DENIED] userId=${userId} context=${projectId || orgId || 'NONE'} missing=[${required.filter((p) => !allPerms.has(p)).join(',')}]`);
        }
        return isGranted;
    }
    async assertCanManageProject(userId, organizationId) {
        const hasAuth = await this.hasPermissions({
            userId,
            required: [permission_constants_1.SystemPermissions.AUTH],
        });
        if (!hasAuth) {
            const perms = await this.getUserPermissions(userId);
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            const role = user?.role;
            throw new common_1.ForbiddenException(`NO_PERMISSION_MANAGE_PROJECT (Debug: user=${userId} role=${role} perms=${perms.join(',')})`);
        }
    }
    async assertCanManageJobs(userId, organizationId) {
        const hasAuth = await this.hasPermissions({
            userId,
            required: [permission_constants_1.SystemPermissions.AUTH],
        });
        if (!hasAuth) {
            throw new common_1.ForbiddenException('NO_PERMISSION_MANAGE_JOB');
        }
    }
};
exports.PermissionService = PermissionService;
exports.PermissionService = PermissionService = PermissionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        permission_cache_1.PermissionCache])
], PermissionService);
//# sourceMappingURL=permission.service.js.map