import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProjectAuthOnly {
    id: string;
    organizationId: string;
    ownerId: string;
}

export interface ProjectNeedSettings {
    id: string;
    organizationId: string;
    settingsJson: unknown | null;
    name: string | null;
}

@Injectable()
export class ProjectResolver {
    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService
    ) { }

    /**
     * 权限校验专用 Resolver (仅包含 ID 和 组织 ID)
     */
    async resolveProjectAuthOnly(
        episode: {
            projectId?: string | null;
            season?: { project?: { id: string; organizationId: string; ownerId: string } | null } | null;
        } | null | undefined
    ): Promise<ProjectAuthOnly | null> {
        if (!episode) return null;

        // 1. Season.project 优先（如果已经预加载）
        const seasonProject = episode.season?.project;
        if (seasonProject?.id && seasonProject?.organizationId && seasonProject?.ownerId) {
            return {
                id: seasonProject.id,
                organizationId: seasonProject.organizationId,
                ownerId: seasonProject.ownerId,
            };
        }

        // 2. 否则根据 projectId 查询，仅选择最小字段
        const projectId = episode.projectId;
        if (!projectId) return null;

        return this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, organizationId: true, ownerId: true },
        });
    }

    /**
     * 业务配置专用 Resolver (包含 settingsJson 和 name)
     */
    async resolveProjectNeedSettings(
        episode: {
            projectId?: string | null;
            season?: {
                project?: {
                    id: string;
                    organizationId: string;
                    settingsJson?: unknown;
                    name?: string;
                } | null;
            } | null;
        } | null | undefined
    ): Promise<ProjectNeedSettings | null> {
        if (!episode) return null;

        // 1. Season.project 优先（要求字段齐全）
        const seasonProject = episode.season?.project;
        if (
            seasonProject?.id &&
            seasonProject?.organizationId &&
            seasonProject?.settingsJson !== undefined
        ) {
            return {
                id: seasonProject.id,
                organizationId: seasonProject.organizationId,
                settingsJson: seasonProject.settingsJson,
                name: seasonProject.name ?? null,
            };
        }

        // 2. 否则通过 projectId 查询最小必要字段
        const projectId = episode.projectId;
        if (!projectId) return null;

        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                organizationId: true,
                settingsJson: true,
                name: true,
            },
        });

        if (!project) return null;

        return {
            id: project.id,
            organizationId: project.organizationId,
            settingsJson: project.settingsJson,
            name: project.name,
        };
    }
}
