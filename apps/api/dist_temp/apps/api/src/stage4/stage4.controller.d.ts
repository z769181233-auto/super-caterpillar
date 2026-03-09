import { Stage4Service } from './stage4.service';
export declare class Stage4Controller {
    private readonly stage4Service;
    constructor(stage4Service: Stage4Service);
    runSemanticEnhancement(projectId: string, sceneId: string, user: {
        userId: string;
    }, organizationId: string | null): Promise<{
        success: boolean;
        data: import("@scu/shared-types").SemanticEnhancementEngineOutput;
    }>;
    getSemanticEnhancement(projectId: string, sceneId: string): Promise<{
        success: boolean;
        data: any;
    }>;
    runShotPlanning(projectId: string, shotId: string, user: {
        userId: string;
    }, organizationId: string | null): Promise<{
        success: boolean;
        data: import("@scu/shared-types").ShotPlanningEngineOutput;
    }>;
    getShotPlanning(projectId: string, shotId: string): Promise<{
        success: boolean;
        data: any;
    }>;
    runStructureQA(projectId: string, user: {
        userId: string;
    }, organizationId: string | null): Promise<{
        success: boolean;
        data: import("@scu/shared-types").StructureQAEngineOutput;
    }>;
    getStructureQA(projectId: string): Promise<{
        success: boolean;
        data: any;
    }>;
}
