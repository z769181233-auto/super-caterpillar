// packages/shared-types/src/novel-analysis.dto.ts

export interface AnalyzedShot {
  index: number; // 镜头序号，从 1 开始
  title: string; // 镜头标题（可用一句话概括）
  summary: string; // 镜头简介
  text: string; // 镜头原始文本
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
  seasons: AnalyzedSeason[];
  stats: {
    seasonsCount: number;
    episodesCount: number;
    scenesCount: number;
    shotsCount: number;
  };
}

// 小说分析状态（与后端/DB 状态保持 1:1 对齐）
export type NovelAnalysisStatus = 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';
