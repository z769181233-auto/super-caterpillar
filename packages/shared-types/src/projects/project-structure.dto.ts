// packages/shared-types/src/projects/project-structure.dto.ts

/**
 * S3-C: Authoritative Project Structure Tree DTO
 * New Standard: Season -> Episode -> Scene -> Shot
 */

export interface ProjectStructureTree {
  // Context
  projectId: string;
  projectName: string;
  projectStatus: string; // 项目状态上下文，供结构页和工作台视图使用

  // Status Fields (Strict)
  sourceType: 'DEMO' | 'NOVEL';
  productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE';
  structureStatus: 'EMPTY' | 'READY';

  // Data Source
  tree: Array<ProjectStructureSeasonNode | ProjectStructureEpisodeNode>;

  // Meta
  counts: {
    seasons: number;
    episodes: number;
    scenes: number;
    shots: number;
  };

  // Client State
  defaultSelection: {
    nodeId: string;
    nodeType: 'season' | 'episode' | 'scene' | 'shot';
  } | null;

  // Status
  statusSummary: {
    analysis: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';
    render: 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED'; // Placeholder for future
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
  // Industrial Fields
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
  shotType: string; // Renamed from 'type' to avoid conflict with node type discriminator, or keep 'type' if safe?
  // User Request: "tree (Season/Episode/Scene/Shot)" implies using specific types.
  // But Shot entity has 'type' (e.g. FULL, CLOSEUP).
  // Let's keep 'type' for the node discriminator and 'shotType' for the data?
  // Or use `kind` for discriminator?
  // The user said: "defaultSelection (nodeId + nodeType)".
  // So let's add `type` property to all nodes for easier discrimination.
  // Industrial Fields
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
