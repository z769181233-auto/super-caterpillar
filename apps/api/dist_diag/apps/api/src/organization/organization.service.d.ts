import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole } from 'database';
export declare class OrganizationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getUserOrganizations(userId: string): Promise<any>;
    createOrganization(userId: string, name: string, slug?: string): Promise<any>;
    getOrganizationById(organizationId: string, userId: string): Promise<any>;
    getCurrentOrganization(userId: string): Promise<string | null>;
    switchOrganization(userId: string, organizationId: string): Promise<{
        organizationId: string;
        role: import("database").$Enums.OrganizationRole;
        organization: {
            id: string;
            name: string;
            slug: string | null;
        } | null;
    }>;
    getUserRole(userId: string, organizationId: string): Promise<OrganizationRole | null>;
}
