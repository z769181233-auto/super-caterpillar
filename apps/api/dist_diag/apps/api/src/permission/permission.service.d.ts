import { PrismaService } from '../prisma/prisma.service';
import { PermissionCache } from './permission.cache';
import { SystemPermission, ProjectPermission } from './permission.constants';
export declare class PermissionService {
    private readonly prisma;
    private readonly cache;
    private readonly logger;
    constructor(prisma: PrismaService, cache: PermissionCache);
    getUserPermissions(userId: string, contextOrgId?: string): Promise<string[]>;
    getProjectPermissions(projectId: string, userId: string): Promise<string[]>;
    hasPermissions(params: {
        userId: string;
        projectId?: string;
        required: Array<SystemPermission | ProjectPermission>;
    }): Promise<boolean>;
    assertCanManageProject(userId: string, organizationId: string): Promise<void>;
    assertCanManageJobs(userId: string, organizationId: string): Promise<void>;
}
