import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NonceService } from '../nonce.service';
export declare class TimestampNonceGuard implements CanActivate {
    private readonly nonceService;
    private reflector;
    private readonly WINDOW_SECONDS;
    constructor(nonceService: NonceService, reflector: Reflector);
    private getPath;
    canActivate(context: ExecutionContext): Promise<boolean>;
}
