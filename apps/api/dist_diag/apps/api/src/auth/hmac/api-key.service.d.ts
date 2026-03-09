import { PrismaService } from '../../prisma/prisma.service';
import { SecretEncryptionService } from '../../security/api-security/secret-encryption.service';
export declare class ApiKeyService {
    private readonly prisma;
    private readonly secretEncryptionService;
    private readonly logger;
    constructor(prisma: PrismaService, secretEncryptionService: SecretEncryptionService);
    private generateApiKey;
    createApiKey(userId?: string, orgId?: string, name?: string): Promise<any>;
    findByKey(key: string): Promise<any>;
    disableApiKey(key: string): Promise<any>;
    enableApiKey(key: string): Promise<any>;
    listApiKeys(userId?: string, orgId?: string): Promise<any>;
}
