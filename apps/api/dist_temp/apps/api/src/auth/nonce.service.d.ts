import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
export declare class NonceService {
    private readonly prisma;
    private readonly auditService;
    private readonly redisService?;
    private readonly logger;
    private readonly devMemoryStore;
    private readonly isDev;
    constructor(prisma: PrismaService, auditService: AuditService, redisService?: RedisService | undefined);
    assertAndStoreNonce(nonce: string, apiKey: string, timestamp: number, requestInfo?: {
        path?: string;
        method?: string;
        ip?: string;
        ua?: string;
    }): Promise<void>;
    private getDatabaseUrlSafe;
}
