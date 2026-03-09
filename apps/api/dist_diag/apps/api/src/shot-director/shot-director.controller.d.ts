import { ShotDirectorService } from './shot-director.service';
export declare class ShotDirectorController {
    private readonly shotDirectorService;
    constructor(shotDirectorService: ShotDirectorService);
    inpaint(shotId: string, user: any): Promise<{
        success: boolean;
        data: {
            shotId: string;
            jobId: string;
            status: string;
        };
    }>;
    pose(shotId: string, user: any): Promise<{
        success: boolean;
        data: {
            shotId: string;
            jobId: string;
            status: string;
        };
    }>;
    composeVideo(sceneId: string, user: any): Promise<{
        success: boolean;
        data: {
            jobId: string;
            status: string;
            assetsCount: number;
        };
    }>;
}
