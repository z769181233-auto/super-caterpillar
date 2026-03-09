import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from './project.service';
import { SceneGraphService } from './scene-graph.service';
import { AnalyzedProjectStructure } from '@scu/shared-types';
export declare class StructureGenerateService {
    private readonly prisma;
    private readonly projectService;
    private readonly sceneGraphService;
    private readonly logger;
    constructor(prisma: PrismaService, projectService: ProjectService, sceneGraphService: SceneGraphService);
    generateStructure(projectId: string, organizationId: string): Promise<any>;
    private extractLocation;
    applyAnalyzedStructureToDatabase(structure: AnalyzedProjectStructure): Promise<void>;
    handleCE06Completed(payload: {
        projectId: string;
        result: any;
    }): Promise<void>;
}
