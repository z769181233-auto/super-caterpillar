import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SecretEncryptionService } from './secret-encryption.service';
import { SignatureVerificationResult, SignatureVerificationContext } from './api-security.types';
export declare class ApiSecurityService {
    private readonly prisma;
    private readonly redis;
    private readonly auditLogService;
    private readonly secretEncryptionService;
    private readonly TIMESTAMP_WINDOW_SECONDS;
    private readonly NONCE_TTL_SECONDS;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, auditLogService: AuditLogService, secretEncryptionService: SecretEncryptionService);
    verifySignature(context: SignatureVerificationContext): Promise<SignatureVerificationResult>;
    buildCanonicalStringV2(method: string, pathWithQuery: string, apiKey: string, timestamp: string, nonce: string, body: string, contentSha256?: string): string;
    sha256Hex(data: Buffer | string): string;
    buildCanonicalString(apiKey: string, nonce: string, timestamp: string, body: string): string;
    computeSignature(secret: string, message: string): string;
    private resolveSecretForApiKey;
    private maskApiKey;
    private writeAuditLog;
}
