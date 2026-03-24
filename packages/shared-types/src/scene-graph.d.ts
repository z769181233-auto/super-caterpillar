export interface ShotNode {
    id: string;
    parentId: string;
    index: number;
    title?: string | null;
    description?: string | null;
    type: string;
    params?: Record<string, any>;
    qualityScore?: Record<string, any>;
    reviewedAt?: string | null;
    durationSeconds?: number | null;
    engineContext?: Record<string, any>;
    videoUrl?: string | null;
    assets?: any[];
}
export interface SceneNode {
    id: string;
    parentId: string;
    index: number;
    title: string;
    summary?: string | null;
    shots: ShotNode[];
    engineContext?: Record<string, any>;
}
export interface EpisodeNode {
    id: string;
    parentId: string;
    index: number;
    name: string;
    summary?: string | null;
    scenes: SceneNode[];
    engineContext?: Record<string, any>;
}
export interface SeasonNode {
    id: string;
    parentId: string;
    index: number;
    title: string;
    description?: string | null;
    episodes: EpisodeNode[];
    engineContext?: Record<string, any>;
}
export interface ProjectSceneGraph {
    projectId: string;
    projectName: string;
    projectStatus: string;
    analysisStatus?: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED' | null;
    analysisUpdatedAt?: string | null;
    seasons: SeasonNode[];
    episodes?: EpisodeNode[];
    engineContext?: Record<string, any>;
}
