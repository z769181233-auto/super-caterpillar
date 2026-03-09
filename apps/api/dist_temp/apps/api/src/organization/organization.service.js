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
exports.OrganizationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
let OrganizationService = class OrganizationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserOrganizations(userId) {
        const memberships = await this.prisma.organizationMember.findMany({
            where: { userId },
            include: {
                organization: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        return memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role,
            joinedAt: m.createdAt,
        }));
    }
    async createOrganization(userId, name, slug) {
        if (slug) {
            const existing = await this.prisma.organization.findUnique({
                where: { slug },
            });
            if (existing) {
                throw new common_1.ForbiddenException('Organization slug already exists');
            }
        }
        const organization = await this.prisma.organization.create({
            data: {
                name,
                slug,
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: database_1.OrganizationRole.OWNER,
                    },
                },
            },
        });
        return organization;
    }
    async getOrganizationById(organizationId, userId) {
        const membership = await this.prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
            include: {
                organization: true,
            },
        });
        if (!membership) {
            throw new common_1.NotFoundException('Organization not found or you are not a member');
        }
        return {
            ...membership.organization,
            role: membership.role,
        };
    }
    async getCurrentOrganization(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { defaultOrganizationId: true },
        });
        if (user?.defaultOrganizationId) {
            const membership = await this.prisma.organizationMember.findUnique({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId: user.defaultOrganizationId,
                    },
                },
            });
            if (membership) {
                return user.defaultOrganizationId;
            }
        }
        const firstMembership = await this.prisma.organizationMember.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        if (firstMembership) {
            return firstMembership.organizationId;
        }
        const personalOrg = await this.createOrganization(userId, `Personal Organization (${userId.substring(0, 8)})`);
        await this.prisma.user.update({
            where: { id: userId },
            data: { defaultOrganizationId: personalOrg.id },
        });
        return personalOrg.id;
    }
    async switchOrganization(userId, organizationId) {
        const membership = await this.prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });
        if (!membership) {
            throw new common_1.ForbiddenException('You are not a member of this organization');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { defaultOrganizationId: organizationId },
        });
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, name: true, slug: true },
        });
        return {
            organizationId,
            role: membership.role,
            organization,
        };
    }
    async getUserRole(userId, organizationId) {
        const membership = await this.prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });
        return membership?.role || null;
    }
};
exports.OrganizationService = OrganizationService;
exports.OrganizationService = OrganizationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationService);
//# sourceMappingURL=organization.service.js.map