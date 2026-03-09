import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorageService } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
export declare class FineGrainedRateLimitGuard extends ThrottlerGuard {
    constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorageService, reflector: Reflector);
    protected getTracker(req: Record<string, any>): Promise<string>;
    protected throwThrottlingException(context: ExecutionContext): Promise<void>;
}
export declare const RateLimit: (limit: number, ttl?: number) => (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => PropertyDescriptor | undefined;
