import { AssetService } from './asset.service';
export declare class AssetController {
    private readonly assetService;
    constructor(assetService: AssetService);
    addWatermark(assetId: string, user: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
