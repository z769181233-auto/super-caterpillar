/**
 * SceneGraph DTO 定义
 * 用于 Studio/前端消费的统一场景图结构
 * 基于五层级结构：Project → Season → Episode → Scene → Shot
 */

/**
 * Shot 节点
 */
export interface ShotNode {
  id: string;
  parentId: string; // Scene ID
  index: number; // 在 Scene 中的顺序
  title?: string | null;
  description?: string | null;
  type: string;
  params?: Record<string, any>; // 引擎参数
  qualityScore?: Record<string, any>; // 质量评分
  reviewedAt?: string | null; // ISO 8601 时间字符串
  durationSeconds?: number | null;
  engineContext?: Record<string, any>; // 预留：引擎上下文（CE07/CE08）
  videoUrl?: string | null; // Stage 8: Enhanced MVP
  assets?: any[]; // Stage 8: Enhanced MVP
}

/**
 * Scene 节点
 */
export interface SceneNode {
  id: string;
  parentId: string; // Episode ID
  index: number; // 在 Episode 中的顺序
  title: string;
  summary?: string | null;
  shots: ShotNode[]; // 子节点：Shots
  engineContext?: Record<string, any>; // 预留：引擎上下文
}

/**
 * Episode 节点
 */
export interface EpisodeNode {
  id: string;
  parentId: string; // Season ID（或 Project ID，用于向后兼容）
  index: number; // 在 Season 中的顺序
  name: string; // Episode 使用 name 字段
  summary?: string | null;
  scenes: SceneNode[]; // 子节点：Scenes
  engineContext?: Record<string, any>; // 预留：引擎上下文
}

/**
 * Season 节点
 */
export interface SeasonNode {
  id: string;
  parentId: string; // Project ID
  index: number; // 在 Project 中的顺序
  title: string;
  description?: string | null;
  episodes: EpisodeNode[]; // 子节点：Episodes
  engineContext?: Record<string, any>; // 预留：引擎上下文
}

/**
 * Project SceneGraph
 * 完整的项目场景图结构
 */
export interface ProjectSceneGraph {
  projectId: string;
  projectName: string;
  projectStatus: string; // ProjectStatus 枚举值
  analysisStatus?: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED' | null; // 小说分析状态
  analysisUpdatedAt?: string | null; // ISO 8601 时间字符串
  seasons: SeasonNode[]; // 影视工业标准：Season → Episode → Scene → Shot
  // 向后兼容：直接关联到 Project 的 Episodes（旧数据）
  episodes?: EpisodeNode[]; // @deprecated 保留用于向下兼容
  engineContext?: Record<string, any>; // 预留：项目级引擎上下文
}
