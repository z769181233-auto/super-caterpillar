import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiSecurityService } from './api-security.service';
export declare class ApiSecurityGuard implements CanActivate {
    private readonly reflector;
    private readonly apiSecurityService;
    constructor(reflector: Reflector, apiSecurityService: ApiSecurityService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
