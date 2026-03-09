import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class ProjectOwnershipGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
