import { ApiSecurityService } from '../../security/api-security/api-security.service';
export declare class HmacAuthService {
    private readonly apiSecurity;
    constructor(apiSecurity: ApiSecurityService);
    verifySignature(apiKeyArg: string, methodArg: string, pathArg: string, bodyArg: string, nonceArg: string, timestampArg: string, signatureArg: string, debug?: {
        ip?: string;
        ua?: string;
        workerId?: string;
        contentSha256?: string;
        hmacVersion?: string;
    }): Promise<any>;
}
