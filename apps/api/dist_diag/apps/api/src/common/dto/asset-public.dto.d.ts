import { FeatureFlagService } from '../../feature-flag/feature-flag.service';
export interface SignedUrlService {
    generate(storageKey: string, tenantId: string, userId: string, ttlMinutes?: number): Promise<{
        url: string;
        expiresAt: Date;
    }>;
}
export declare class AssetPublicDto {
    id: string;
    type: 'IMAGE' | 'VIDEO' | 'MODEL';
    status: 'GENERATED' | 'LOCKED' | 'PUBLISHED';
    storageKey: string;
    signedUrl?: string;
    signedUrlExpiresAt?: string;
    static fromAsset(asset: {
        id: string;
        type: 'IMAGE' | 'VIDEO' | 'MODEL';
        status: 'GENERATED' | 'LOCKED' | 'PUBLISHED';
        storageKey: string;
    }, featureFlagService: FeatureFlagService, signedUrlService: SignedUrlService, context: {
        tenantId: string;
        userId: string;
    }): Promise<AssetPublicDto>;
}
