"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimit = exports.FineGrainedRateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
let FineGrainedRateLimitGuard = class FineGrainedRateLimitGuard extends throttler_1.ThrottlerGuard {
    constructor(options, storageService, reflector) {
        super(options, storageService, reflector);
    }
    async getTracker(req) {
        const userId = req.user?.id || req.user?.userId || 'anonymous';
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        return `${ip}:${userId}`;
    }
    async throwThrottlingException(context) {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const limit = this.reflector.get('rateLimit', context.getHandler());
        const ttl = this.reflector.get('rateLimitTtl', context.getHandler());
        throw new common_1.HttpException({
            statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `请求过于频繁，请稍后再试。限制：${limit || 100} 次/${ttl || 60}秒`,
            },
        }, common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
};
exports.FineGrainedRateLimitGuard = FineGrainedRateLimitGuard;
exports.FineGrainedRateLimitGuard = FineGrainedRateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, throttler_1.ThrottlerStorageService,
        core_1.Reflector])
], FineGrainedRateLimitGuard);
const RateLimit = (limit, ttl = 60) => {
    return (target, propertyKey, descriptor) => {
        if (descriptor) {
            Reflect.defineMetadata('rateLimit', limit, descriptor.value);
            Reflect.defineMetadata('rateLimitTtl', ttl, descriptor.value);
        }
        return descriptor;
    };
};
exports.RateLimit = RateLimit;
//# sourceMappingURL=rate-limit.guard.js.map