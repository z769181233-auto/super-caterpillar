export interface SignedUrlOptions {
    key: string;
    tenantId: string;
    userId: string;
    expiresIn?: number;
    method?: string;
}
export interface SignedUrlResult {
    url: string;
    expiresAt: Date;
    signature: string;
}
export declare class SignedUrlService {
    private readonly logger;
    private readonly secret;
    private readonly defaultExpiresIn;
    private readonly baseUrl;
    constructor();
    generateSignedUrl(options: SignedUrlOptions): SignedUrlResult;
    verifySignedUrl(key: string, expires: number, signature: string, tenantId: string, userId: string, method?: string): boolean;
    generateBatchSignedUrls(keys: string[], tenantId: string, userId: string, expiresIn?: number): SignedUrlResult[];
    private encodeKeyAsPath;
}
