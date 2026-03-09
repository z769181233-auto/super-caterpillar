import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class GateModeGuard implements CanActivate {
    canActivate(_ctx: ExecutionContext): boolean;
}
