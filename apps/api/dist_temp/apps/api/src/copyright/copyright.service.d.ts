import { PrismaService } from '../prisma/prisma.service';
export declare class CopyrightService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    registerAsset(userId: string, assetType: string, content: string): Promise<{
        registrationId: `${string}-${string}-${string}-${string}-${string}`;
        hash: string;
        timestamp: Date;
        status: string;
    }>;
    verifyAsset(hash: string): Promise<{
        hash: string;
        verified: boolean;
        ownerId: string;
        timestamp: Date;
    }>;
}
