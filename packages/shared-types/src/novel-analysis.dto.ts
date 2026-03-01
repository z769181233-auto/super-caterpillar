// packages/shared-types/src/novel-analysis.dto.ts

export interface AnalyzedShot {
  index: number; // 镜头序号，从 1 开始
  title?: string; // 镜头标题
  summary?: string; // 镜头简介
  text?: string; // 原始文本
  shotType?: string; // [V3.0] 镜头类型 (close_up, wide等)
  emotion?: string; // [V3.0] 情绪描述
  novelQuote?: string; // [V3.0] 小说原句锚点
  durationSec?: number; // [V3.0] 镜头时长
}

export interface AnalyzedScene {
  index: number; // 场景序号，从 1 开始
  title: string; // 场景标题
  summary: string; // 场景简介
  shots: AnalyzedShot[];
}

export interface AnalyzedEpisode {
  index: number; // 集数，从 1 开始
  title: string; // 集标题
  summary: string; // 集简介
  scenes: AnalyzedScene[];
}

export interface AnalyzedSeason {
  index: number; // 季，从 1 开始
  title: string; // 季标题
  summary: string; // 季简介
  episodes: AnalyzedEpisode[];
}

export interface AnalyzedProjectStructure {
  projectId: string;
  seasons?: AnalyzedSeason[]; // [Deprecated] For V1.1 backward compatibility
  episodes: AnalyzedEpisode[]; // [V3.0] Flat structure: Project -> Episode
  stats: {
    seasonsCount: number;
    episodesCount: number;
    scenesCount: number;
    shotsCount: number;
  };
}

// 小说分析状态（与后端/DB 状态保持 1:1 对齐）
export type NovelAnalysisStatus = 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';
