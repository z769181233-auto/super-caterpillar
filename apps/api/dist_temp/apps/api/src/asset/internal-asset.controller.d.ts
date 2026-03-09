import { SignedUrlService } from '../storage/signed-url.service';
export declare class InternalAssetController {
    private readonly signedUrlService;
    constructor(signedUrlService: SignedUrlService);
    getPublicUrl(key: string): {
        url: string;
        expiresAt: Date;
        storageKey: string;
    };
}
