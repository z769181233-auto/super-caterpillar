import { PrismaService } from '../prisma/prisma.service';
export declare class FeatureFlagService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    isEnabled(flagName: string, context?: {
        orgId?: string;
        projectId?: string;
        userId?: string;
    }): boolean;
    private simpleHash;
    isAutoReworkEnabled(context: {
        orgId?: string;
        projectId?: string;
    }): Promise<boolean>;
    getAllFlags(): Record<string, boolean>;
}
