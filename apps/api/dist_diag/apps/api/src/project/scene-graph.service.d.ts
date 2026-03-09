import { PrismaService } from '../prisma/prisma.service';
import { ProjectSceneGraph } from '@scu/shared-types';
import { SceneGraphCache } from './scene-graph.cache';
export declare class SceneGraphService {
    private readonly prisma;
    private readonly cache;
    private readonly logger;
    constructor(prisma: PrismaService, cache: SceneGraphCache);
    handleStructureChanged(payload: {
        projectId: string;
        context?: string;
    }): Promise<void>;
    getProjectSceneGraph(projectId: string): Promise<ProjectSceneGraph>;
    invalidateProjectSceneGraph(projectId: string): Promise<void>;
    private mapSeasonToNode;
    private mapEpisodeToNode;
    private mapSceneToNode;
    private mapShotToNode;
}
