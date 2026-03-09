import { Request } from 'express';
import { UserService } from './user.service';
import { OrganizationService } from '../organization/organization.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class UserController {
    private readonly userService;
    private readonly organizationService;
    private readonly auditLogService;
    constructor(userService: UserService, organizationService: OrganizationService, auditLogService: AuditLogService);
    getCurrentUser(user: {
        userId: string;
    }): Promise<any>;
    switchOrganization(body: {
        organizationId: string;
    }, user: {
        userId: string;
    }, request: Request): Promise<any>;
    getQuota(user: {
        userId: string;
    }): Promise<any>;
}
