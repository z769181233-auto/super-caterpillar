// packages/shared-types/src/novel-analysis.dto.ts

import { JsonObject } from './json';

export interface AnalyzedShot {
  index: number; // 镜头序号，从 1 开始
  title?: string; // 镜头标题
  summary?: string; // 镜头简介
  text?: string; // 原始文本
  shotType?: string; // [V3.0] 镜头类型 (close_up, wide等)
  camera?: JsonObject; // [SSOT] 相机参数
  characters?: string[]; // [SSOT] 镜头角色列表
  action?: string; // [SSOT] 动作描述
  emotion?: string; // [V3.0] 情绪描述
  novelQuote?: string; // [V3.0] 小说原句锚点
  durationSec?: number; // [V3.0] 镜头时长
}

export interface AnalyzedScene {
  index: number; // 场景序号，从 1 开始
  title: string; // 场景标题
  summary: string; // 场景简介
  characters?: string[]; // 最小语义抽取：场景主要人物
  location?: string; // 最小语义抽取：场景地点
  timeOfDay?: string; // 最小语义抽取：时间语义
  emotionalTone?: string; // 最小语义抽取：主情绪
  conflictSummary?: string; // 最小语义抽取：冲突摘要
  semanticSummary?: string; // 最小语义抽取：可读摘要
  chapterContextSummary?: string; // 上下文语义引擎：chapter 级摘要真相
  memoryContextSummary?: string; // 长文本记忆/摘要体系：memory 级上下文真相
  memoryContextSource?: string; // 长文本记忆/摘要体系：memory 来源
  crossChapterMemoryHit?: boolean; // 长文本记忆/摘要体系：是否命中跨章节记忆
  semanticMethod?: string; // 上下文语义引擎：提取方法
  fallbackStrategy?: string; // 上下文语义引擎：fallback 策略
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
  seasons?: AnalyzedSeason[]; // 仅旧输出仍会返回；新代码应优先消费扁平 episodes
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
