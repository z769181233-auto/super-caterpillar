import { Request, Response } from 'express';
import { SignedUrlService } from './signed-url.service';
import { LocalStorageService } from './local-storage.service';
import { StorageAuthService } from './storage-auth.service';
import { AuthenticatedUser } from '@scu/shared-types';
export declare class StorageController {
    private readonly signedUrlService;
    private readonly localStorageService;
    private readonly storageAuthService;
    private readonly logger;
    constructor(signedUrlService: SignedUrlService, localStorageService: LocalStorageService, storageAuthService: StorageAuthService);
    probe(): string;
    signUrl(rawKey: any, user: AuthenticatedUser, orgId: string): Promise<{
        url: string;
        expiresAt: Date;
    }>;
    serveSigned(rawKey: any, expires: string, signature: string, tenantId: string, userId: string, req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    uploadNovel(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
