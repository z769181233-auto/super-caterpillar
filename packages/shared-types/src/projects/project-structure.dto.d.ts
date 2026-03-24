export interface ProjectStructureTree {
    projectId: string;
    projectName: string;
    projectStatus: string;
    sourceType: 'DEMO' | 'NOVEL';
    productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE';
    structureStatus: 'EMPTY' | 'READY';
    tree: ProjectStructureSeasonNode[];
    counts: {
        seasons: number;
        episodes: number;
        scenes: number;
        shots: number;
    };
    defaultSelection: {
        nodeId: string;
        nodeType: 'season' | 'episode' | 'scene' | 'shot';
    } | null;
    statusSummary: {
        analysis: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';
        render: 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED';
    };
}
export interface ProjectStructureSeasonNode {
    type: 'season';
    id: string;
    index: number;
    title: string;
    summary?: string | null;
    episodes: ProjectStructureEpisodeNode[];
}
export interface ProjectStructureEpisodeNode {
    type: 'episode';
    id: string;
    index: number;
    name: string;
    summary?: string | null;
    scenes: ProjectStructureSceneNode[];
}
export interface ProjectStructureSceneNode {
    type: 'scene';
    id: string;
    index: number;
    title: string;
    summary?: string | null;
    visualDensityScore?: number | null;
    enrichedText?: string | null;
    qaStatus?: 'PASS' | 'WARN' | 'FAIL' | 'PENDING';
    blockingReason?: string | null;
    canGenerate?: boolean;
    shots: ProjectStructureShotNode[];
}
export interface ProjectStructureShotNode {
    type: 'shot';
    id: string;
    index: number;
    title?: string | null;
    description?: string | null;
    shotType: string;
    qaStatus?: 'PASS' | 'WARN' | 'FAIL' | 'PENDING';
    blockingReason?: string | null;
    canGenerate?: boolean;
}
