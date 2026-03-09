import { Response, Request } from 'express';
import { OrganizationService } from './organization.service';
import { AuthService } from '../auth/auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class OrganizationController {
    private readonly organizationService;
    private readonly authService;
    private readonly auditLogService;
    constructor(organizationService: OrganizationService, authService: AuthService, auditLogService: AuditLogService);
    getUserOrganizations(user: {
        userId: string;
    }): Promise<any>;
    createOrganization(body: {
        name: string;
        slug?: string;
    }, user: {
        userId: string;
    }): Promise<any>;
    getOrganization(id: string, user: {
        userId: string;
    }): Promise<any>;
    switchOrganization(body: {
        organizationId: string;
    }, user: {
        userId: string;
        email: string;
        tier: string;
    }, res: Response, request: Request): Promise<any>;
}
