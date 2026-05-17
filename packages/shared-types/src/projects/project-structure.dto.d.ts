export interface ProjectStructureTree {
    projectId: string;
    projectName: string;
    projectStatus: string;
    sourceType: 'DEMO' | 'NOVEL';
    productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE';
    structureStatus: 'EMPTY' | 'READY';
    tree: Array<ProjectStructureSeasonNode | ProjectStructureEpisodeNode>;
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
    characters?: unknown;
    characterIds?: unknown;
    directingNotes?: string | null;
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
    content?: string | null;
    actionDescription?: string | null;
    dialogueContent?: string | null;
    productionScript?: ProjectStructureProductionScript | null;
    visualDescription?: string | null;
    visualPrompt?: string | null;
    cameraMovement?: string | null;
    cameraAngle?: string | null;
    lightingPreset?: string | null;
    soundFx?: string | null;
    durationSec?: number | null;
    durationSeconds?: number | null;
    dramaticFunction?: string | null;
    emotionalTarget?: string | null;
    videoUrl?: string | null;
    novelQuote?: string | null;
    shotType: string;
    qaStatus?: 'PASS' | 'WARN' | 'FAIL' | 'PENDING';
    blockingReason?: string | null;
    canGenerate?: boolean;
}
export interface ProjectStructureProductionScript {
    sceneBeat?: string | null;
    characterBlocking?: string | null;
    performanceNote?: string | null;
    artDirection?: string | null;
    soundDesign?: string | null;
    editNote?: string | null;
    continuity?: string | null;
    productionRemark?: string | null;
}
