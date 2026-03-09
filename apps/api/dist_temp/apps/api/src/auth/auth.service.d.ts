import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<{
        success: boolean;
        data: {
            user: {
                id: string;
                email: string;
                avatar: string | null;
                userType: import("database").$Enums.UserType;
                role: import("database").$Enums.UserRole;
                tier: import("database").$Enums.UserTier;
                organizationId: string;
            };
            accessToken: string;
            refreshToken: string;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        success: boolean;
        data: {
            user: {
                id: string;
                email: string;
                avatar: string | null;
                userType: import("database").$Enums.UserType;
                role: import("database").$Enums.UserRole;
                tier: import("database").$Enums.UserTier;
            };
            accessToken: string;
            refreshToken: string;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    refresh(refreshToken: string): Promise<{
        success: boolean;
        data: {
            accessToken: string;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    generateTokens(userId: string, email: string, tier: string, organizationId: string | null): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private generateAccessToken;
    private generateRefreshToken;
    private getCurrentOrganization;
    private ensurePersonalOrganization;
}
