import { ProjectStructureService } from './project-structure.service';
import { ProjectStructureTree } from '@scu/shared-types';
export declare class ProjectStructureController {
    private readonly projectStructureService;
    constructor(projectStructureService: ProjectStructureService);
    getProjectStructure(projectId: string, user: {
        userId: string;
    }, organizationId: string | null): Promise<{
        success: boolean;
        data: ProjectStructureTree;
        requestId: string;
        timestamp: string;
    }>;
}
