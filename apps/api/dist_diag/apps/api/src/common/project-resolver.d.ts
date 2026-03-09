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
export declare class ProjectResolver {
    private readonly prisma;
    constructor(prisma: PrismaService);
    resolveProjectAuthOnly(episode: {
        projectId?: string | null;
        season?: {
            project?: {
                id: string;
                organizationId: string;
                ownerId: string;
            } | null;
        } | null;
    } | null | undefined): Promise<ProjectAuthOnly | null>;
    resolveProjectNeedSettings(episode: {
        projectId?: string | null;
        season?: {
            project?: {
                id: string;
                organizationId: string;
                settingsJson?: unknown;
                name?: string;
            } | null;
        } | null;
    } | null | undefined): Promise<ProjectNeedSettings | null>;
}
