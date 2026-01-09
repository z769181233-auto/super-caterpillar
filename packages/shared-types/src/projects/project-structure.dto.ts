// packages/shared-types/src/projects/project-structure.dto.ts

/**
 * S3-C: Authoritative Project Structure Tree DTO
 * New Standard: Season -> Episode -> Scene -> Shot
 */

export interface ProjectStructureTree {
  // Context
  projectId: string;
  projectName: string;
  projectStatus: string; // Added for legacy compatibility and context

  // Status Fields (Strict)
  sourceType: 'DEMO' | 'NOVEL';
  productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE';
  structureStatus: 'EMPTY' | 'READY';

  // Data Source
  tree: ProjectStructureSeasonNode[];

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
