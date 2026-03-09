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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtOrHmacGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const hmac_auth_guard_1 = require("../hmac/hmac-auth.guard");
const public_decorator_1 = require("../decorators/public.decorator");
let JwtOrHmacGuard = class JwtOrHmacGuard {
    jwtAuthGuard;
    hmacAuthGuard;
    reflector;
    constructor(jwtAuthGuard, hmacAuthGuard, reflector) {
        this.jwtAuthGuard = jwtAuthGuard;
        this.hmacAuthGuard = hmacAuthGuard;
        this.reflector = reflector;
    }
    getHeader(req, name) {
        const v1 = typeof req?.get === 'function' ? req.get(name) : undefined;
        if (typeof v1 === 'string' && v1.length > 0)
            return v1;
        const h = req?.headers || {};
        const key = name.toLowerCase();
        const v2 = h[key];
        return typeof v2 === 'string' && v2.length > 0 ? v2 : undefined;
    }
    hasJwt(req) {
        const authHeader = req?.headers?.['authorization'];
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            return true;
        }
        return !!req?.cookies?.['accessToken'];
    }
    hasHmac(req) {
        const apiKey = this.getHeader(req, 'X-Api-Key');
        const sig = this.getHeader(req, 'X-Signature');
        const nonce = this.getHeader(req, 'X-Nonce');
        const ts = this.getHeader(req, 'X-Timestamp');
        return !!(apiKey || sig || nonce || ts);
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const dbg = process.env.HMAC_DEBUG === '1';
        const dlog = (obj) => {
            if (!dbg)
                return;
            try {
                console.log(JSON.stringify({ tag: 'HMAC_DEBUG_STEP', ...obj }));
            }
            catch {
            }
        };
        if (this.hasJwt(req)) {
            dlog({ step: 'jwt_or_hmac_branch', branch: 'jwt' });
            return (await this.jwtAuthGuard.canActivate(context));
        }
        if (this.hasHmac(req)) {
            dlog({ step: 'jwt_or_hmac_branch', branch: 'hmac' });
            return (await this.hmacAuthGuard.canActivate(context));
        }
        dlog({ step: 'jwt_or_hmac_branch', branch: 'none' });
        throw new common_1.UnauthorizedException('Missing auth header (JWT or HMAC required)');
    }
};
exports.JwtOrHmacGuard = JwtOrHmacGuard;
exports.JwtOrHmacGuard = JwtOrHmacGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => jwt_auth_guard_1.JwtAuthGuard))),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => hmac_auth_guard_1.HmacAuthGuard))),
    __param(2, (0, common_1.Inject)(core_1.Reflector)),
    __metadata("design:paramtypes", [jwt_auth_guard_1.JwtAuthGuard,
        hmac_auth_guard_1.HmacAuthGuard,
        core_1.Reflector])
], JwtOrHmacGuard);
//# sourceMappingURL=jwt-or-hmac.guard.js.map