import { PrismaService } from '../prisma/prisma.service';
export declare class StorageAuthService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    verifyAccess(key: string, tenantId: string, userId: string): Promise<boolean>;
    private assertValidStorageKey;
    getStoragePath(key: string): string;
}
