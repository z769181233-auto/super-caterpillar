"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const config_1 = require("@scu/config");
const database_1 = require("database");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(registerDto) {
        const { email, password, userType = 'individual' } = registerDto;
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, config_1.env.bcryptSaltRounds);
        const { user, organizationId } = await this.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    userType,
                    role: database_1.UserRole.creator,
                    tier: database_1.UserTier.Free,
                    quota: {
                        remainingTokens: 1000,
                        computeSeconds: 3600,
                        credits: 100,
                    },
                },
            });
            const org = await tx.organization.upsert({
                where: {
                    ownerId_type: {
                        ownerId: newUser.id,
                        type: 'PERSONAL',
                    },
                },
                update: {},
                create: {
                    name: `Personal Org (${email})`,
                    slug: `personal-${newUser.id.substring(0, 8)}`,
                    ownerId: newUser.id,
                    type: 'PERSONAL',
                },
            });
            await tx.organizationMember.upsert({
                where: {
                    userId_organizationId: {
                        userId: newUser.id,
                        organizationId: org.id,
                    },
                },
                update: { role: 'OWNER' },
                create: {
                    userId: newUser.id,
                    organizationId: org.id,
                    role: 'OWNER',
                },
            });
            await tx.user.update({
                where: { id: newUser.id },
                data: { defaultOrganizationId: org.id },
            });
            this.logger.log(`[AUTH_REG] Success: userId=${newUser.id} orgId=${org.id} role=OWNER`);
            return { user: newUser, organizationId: org.id };
        });
        const tokens = await this.generateTokens(user.id, user.email, user.tier, organizationId);
        return {
            success: true,
            data: {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    avatar: user.avatar,
                    userType: user.userType,
                    role: user.role,
                    tier: user.tier,
                    organizationId,
                },
            },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async login(loginDto) {
        const { email, password } = loginDto;
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        let organizationId = await this.getCurrentOrganization(user.id);
        if (!organizationId) {
            this.logger.warn(`[AUTH_FIX] User ${user.email} (id=${user.id}) has no organization. Creating Personal Org...`);
            await this.ensurePersonalOrganization(user.id, user.email);
            organizationId = await this.getCurrentOrganization(user.id);
        }
        const tokens = await this.generateTokens(user.id, user.email, user.tier, organizationId);
        return {
            success: true,
            data: {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    avatar: user.avatar,
                    userType: user.userType,
                    role: user.role,
                    tier: user.tier,
                },
            },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async refresh(refreshToken) {
        try {
            const payload = jwt.verify(refreshToken, config_1.env.jwtRefreshSecret);
            if (payload.type !== 'refresh') {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            const currentOrganizationId = await this.getCurrentOrganization(user.id);
            const accessToken = await this.generateAccessToken(user.id, user.email, user.tier, currentOrganizationId);
            return {
                success: true,
                data: {
                    accessToken,
                },
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async generateTokens(userId, email, tier, organizationId) {
        const [accessToken, refreshToken] = await Promise.all([
            this.generateAccessToken(userId, email, tier, organizationId),
            this.generateRefreshToken(userId, email, tier, organizationId),
        ]);
        return { accessToken, refreshToken };
    }
    async generateAccessToken(userId, email, tier, organizationId) {
        const payload = {
            sub: userId,
            email,
            tier,
            orgId: organizationId,
        };
        return this.jwtService.signAsync(payload);
    }
    async generateRefreshToken(userId, email, tier, organizationId) {
        const payload = {
            sub: userId,
            email,
            tier,
            orgId: organizationId,
            type: 'refresh',
        };
        return jwt.sign(payload, config_1.env.jwtRefreshSecret, {
            expiresIn: config_1.env.jwtRefreshExpiresIn,
        });
    }
    async getCurrentOrganization(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { defaultOrganizationId: true },
        });
        if (user?.defaultOrganizationId) {
            const membership = await this.prisma.organizationMember.findUnique({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId: user.defaultOrganizationId,
                    },
                },
            });
            if (membership)
                return user.defaultOrganizationId;
        }
        const firstMembership = await this.prisma.organizationMember.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        return firstMembership?.organizationId || null;
    }
    async ensurePersonalOrganization(userId, email) {
        await this.prisma.$transaction(async (tx) => {
            const org = await tx.organization.upsert({
                where: {
                    ownerId_type: {
                        ownerId: userId,
                        type: 'PERSONAL',
                    },
                },
                update: {},
                create: {
                    name: `Personal Org (${email})`,
                    slug: `personal-${userId.substring(0, 8)}`,
                    ownerId: userId,
                    type: 'PERSONAL',
                },
            });
            await tx.organizationMember.upsert({
                where: {
                    userId_organizationId: {
                        userId: userId,
                        organizationId: org.id,
                    },
                },
                update: { role: 'OWNER' },
                create: {
                    userId: userId,
                    organizationId: org.id,
                    role: 'OWNER',
                },
            });
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user?.defaultOrganizationId) {
                await tx.user.update({
                    where: { id: userId },
                    data: { defaultOrganizationId: org.id },
                });
            }
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(jwt_1.JwtService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map