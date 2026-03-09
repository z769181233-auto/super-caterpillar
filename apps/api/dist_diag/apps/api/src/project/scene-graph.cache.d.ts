import { RedisService } from '../redis/redis.service';
import { ProjectSceneGraph } from '@scu/shared-types';
export declare class SceneGraphCache {
    private readonly redis;
    private readonly logger;
    constructor(redis: RedisService);
    get(projectId: string): Promise<ProjectSceneGraph | null>;
    set(projectId: string, sceneGraph: ProjectSceneGraph): Promise<void>;
    invalidate(projectId: string): Promise<void>;
}
