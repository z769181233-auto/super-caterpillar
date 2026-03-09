"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitModule = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const rate_limit_guard_1 = require("./rate-limit.guard");
let RateLimitModule = class RateLimitModule {
};
exports.RateLimitModule = RateLimitModule;
exports.RateLimitModule = RateLimitModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'default',
                    ttl: 60000,
                    limit: 10000,
                },
                {
                    name: 'auth',
                    ttl: 60000,
                    limit: 10,
                },
                {
                    name: 'signature',
                    ttl: 60000,
                    limit: 30,
                },
                {
                    name: 'download',
                    ttl: 60000,
                    limit: 200,
                },
            ]),
        ],
        providers: [rate_limit_guard_1.FineGrainedRateLimitGuard],
        exports: [rate_limit_guard_1.FineGrainedRateLimitGuard],
    })
], RateLimitModule);
//# sourceMappingURL=rate-limit.module.js.map