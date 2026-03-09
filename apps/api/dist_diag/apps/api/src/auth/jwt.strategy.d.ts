import { Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
export interface JwtPayload {
    sub: string;
    email: string;
    tier: string;
    orgId?: string;
}
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    validate(payload: JwtPayload): Promise<{
        userId: string;
        email: string;
        userType: import("database").$Enums.UserType;
        role: import("database").$Enums.UserRole;
        tier: import("database").$Enums.UserTier;
        organizationId: string | null;
    }>;
}
export {};
