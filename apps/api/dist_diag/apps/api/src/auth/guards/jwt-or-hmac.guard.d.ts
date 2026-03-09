import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HmacAuthGuard } from '../hmac/hmac-auth.guard';
export declare class JwtOrHmacGuard implements CanActivate {
    private readonly jwtAuthGuard;
    private readonly hmacAuthGuard;
    private readonly reflector;
    constructor(jwtAuthGuard: JwtAuthGuard, hmacAuthGuard: HmacAuthGuard, reflector: Reflector);
    private getHeader;
    private hasJwt;
    private hasHmac;
    canActivate(context: ExecutionContext): Promise<boolean>;
}
