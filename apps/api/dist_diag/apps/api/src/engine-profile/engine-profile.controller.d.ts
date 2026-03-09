import { EngineProfileService } from './engine-profile.service';
import type { EngineProfileResponse } from '@scu/shared-types';
export declare class EngineProfileController {
    private readonly engineProfileService;
    constructor(engineProfileService: EngineProfileService);
    getSummary(engineKey?: string, projectId?: string, from?: string, to?: string): Promise<{
        success: boolean;
        data: EngineProfileResponse;
        requestId: string;
        timestamp: string;
    }>;
}
