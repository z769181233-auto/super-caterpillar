import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
export interface TextSafetyOutcome {
    decision: 'PASS' | 'WARN' | 'BLOCK';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    sanitizedText: string;
    sanitizedDigest: string;
    flags: string[];
    reasons: string[];
    traceId?: string;
}
export interface TextSafetyContext {
    projectId: string;
    userId?: string;
    apiKeyId?: string;
    orgId?: string;
    ip?: string;
    userAgent?: string;
    traceId?: string;
    resourceType?: string;
    resourceId?: string;
}
export declare class TextSafetyService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly featureFlagService;
    private readonly logger;
    private readonly BLACKLIST_KEYWORDS;
    private readonly GREYLIST_PATTERNS;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, featureFlagService: FeatureFlagService);
    sanitize(inputText: string, context: TextSafetyContext): Promise<TextSafetyOutcome>;
    private checkBlacklist;
    private checkGreylist;
    private removePlaceholders;
    private sha256;
    static readonly TEST_BLACKLIST_KEYWORD = "violation";
    static readonly TEST_GREYLIST_PATTERN = "\u5FAE\u4FE1\u53F7test123";
}
