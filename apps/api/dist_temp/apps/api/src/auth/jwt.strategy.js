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
var JwtStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@scu/config");
let JwtStrategy = JwtStrategy_1 = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    prisma;
    logger = new common_1.Logger(JwtStrategy_1.name);
    constructor(prisma) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                (request) => {
                    return request?.cookies?.accessToken || null;
                },
                passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || config_1.env.jwtSecret,
        });
        this.prisma = prisma;
    }
    async validate(payload) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                userType: true,
                role: true,
                tier: true,
            },
        });
        if (!user) {
            this.prisma.user
                .findMany()
                .then((all) => JSON.stringify(all.map((u) => u.id)))
                .then((ids) => {
                this.logger.error(`[DEBUG] User NOT found. Payload sub: ${payload.sub}. Available IDs: ${ids}`);
            });
            throw new common_1.UnauthorizedException('User not found');
        }
        let organizationId = null;
        if (payload.orgId) {
            const membership = await this.prisma.organizationMember.findFirst({
                where: {
                    organizationId: payload.orgId,
                    userId: user.id,
                },
            });
            if (!membership) {
                const org = await this.prisma.organization.findUnique({
                    where: { id: payload.orgId },
                    select: { ownerId: true },
                });
                if (org && org.ownerId === user.id) {
                    organizationId = payload.orgId;
                }
                else {
                    organizationId = null;
                }
            }
            else {
                organizationId = payload.orgId;
            }
        }
        return {
            userId: user.id,
            email: user.email,
            userType: user.userType,
            role: user.role,
            tier: user.tier,
            organizationId,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = JwtStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map