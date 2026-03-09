import { Request } from 'express';
export interface SignatureVerificationResult {
    success: boolean;
    apiKeyId?: string;
    apiKey?: string;
    apiKeyRecord?: any;
    errorCode?: string;
    errorMessage?: string;
}
export interface SignatureVerificationContext {
    apiKey: string;
    nonce: string;
    timestamp: string;
    signature: string;
    method: string;
    path: string;
    contentSha256: string;
    body?: string;
    ip?: string;
    userAgent?: string;
}
export interface SignatureAuditDetails {
    nonce: string;
    signature: string;
    timestamp: string;
    path: string;
    method: string;
    apiKey?: string;
    reason?: string;
    errorCode?: string;
}
export interface RequestWithApiSecurity extends Request {
    rawBody?: Buffer | string;
    apiKey?: string;
    apiKeyId?: string;
}
