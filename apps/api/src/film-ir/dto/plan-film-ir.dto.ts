/**
 * FilmIR Planner — Provider 接口与 DTO 定义（P2-1）
 *
 * 本文件定义 Script-to-Directing LLM Planner 的：
 * 1. 核心 DTO（PlanFilmIRRequest / PlanFilmIRResponse / FilmIRDraftFields）
 * 2. 结构化输出 schema（LLM 必须输出的字段规范）
 * 3. 枚举合法值（用于校验 LLM 输出）
 *
 * 设计原则（P2-1 约束）：
 * - 支持 dry_run（不写 DB，只返回规划结果）
 * - 支持 save_as_draft（写 DRAFT 记录，不 approve）
 * - Planner 输出失败不污染 APPROVED/LOCKED 数据
 * - 结构化校验前置，枚举/必填字段必须通过才写 DB
 */

// ==================================================================
// 合法枚举值（用于后端校验 LLM 输出，防止幻觉值写入 DB）
// ==================================================================

export const VALID_DRAMATIC_FUNCTIONS = [
  'CONFLICT',
  'REVELATION',
  'TENSION_BUILD',
  'RESOLUTION',
  'SETUP',
  'TURNING_POINT',
  'CHARACTER_DEVELOPMENT',
  'EXPOSITION',
] as const;

export type DramaticFunctionEnum = (typeof VALID_DRAMATIC_FUNCTIONS)[number];

export const VALID_TENSION_CURVES = [
  'RISING',
  'FALLING',
  'PLATEAU',
  'SPIKE',
  'VALLEY',
  'SUSTAINED_HIGH',
] as const;

export type TensionCurveEnum = (typeof VALID_TENSION_CURVES)[number];

export const VALID_AUDIENCE_INFO_MODES = [
  'DRAMATIC_IRONY',
  'SUSPENSE',
  'MYSTERY',
  'OMNISCIENT',
  'LIMITED_POV',
] as const;

export const VALID_SHOT_PATTERNS = [
  'CLOSE_UP_DOMINANT',
  'WIDE_ESTABLISH',
  'PARALLEL_EDIT',
  'POV_SUBJECTIVE',
  'MONTAGE',
  'LONG_TAKE',
  'MIXED',
] as const;

export const VALID_CAMERA_DISTANCES = [
  'INTIMATE',
  'NEUTRAL',
  'EPIC',
  'EXTREME_CLOSE',
  'MEDIUM_CLOSE',
] as const;

export const VALID_CAMERA_ANGLES = [
  'EYE_LEVEL',
  'LOW_ANGLE',
  'HIGH_ANGLE',
  'DUTCH',
  'OVERHEAD',
  'WORM_EYE',
] as const;

export const VALID_CAMERA_MOTIONS = [
  'STATIC',
  'HANDHELD',
  'SMOOTH_CRANE',
  'TRACKING',
  'DOLLY',
  'AERIAL',
  'MIXED',
] as const;

export const VALID_LIGHTING_STYLES = [
  'HIGH_KEY',
  'LOW_KEY',
  'CHIAROSCURO',
  'NATURAL',
  'MOTIVATED',
  'DOCUMENTARY',
] as const;

// ==================================================================
// 请求 DTO
// ==================================================================

/**
 * POST /film-ir/plan 请求体
 * POST /film-ir/:sceneId/replan 请求体
 */
export interface PlanFilmIRRequest {
  /** 目标 scene id（必填）*/
  scene_id: string;

  /** 原始场景文本（如不提供则从 Scene.enrichedText 读取）*/
  source_text?: string;

  /** 上下文摘要（前后章节信息，用于提升导演决策质量）*/
  source_context_summary?: string;

  /** 用户预设戏剧目标（可选，Planner 可参考但不强制采纳）*/
  dramatic_goal?: string;

  /** 入场前人物关系（可选）*/
  relationship_before?: string;

  /** 出场后人物关系（可选）*/
  relationship_after?: string;

  /** 指定 planner 版本（默认 'film-planner-v1'）*/
  planner_version?: string;

  /**
   * dry_run = true：只返回规划结果，不写 DB
   * 用于预览、调试、前端实时反馈
   */
  dry_run?: boolean;

  /**
   * save_as_draft = true（默认 true）：将结果写入 DB DRAFT 状态
   * Planner 成功且通过结构化校验后才执行写入
   */
  save_as_draft?: boolean;

  /**
   * force_replan = true：即使 scene 已有 APPROVED 记录，也强制创建新版本
   * 注意：不会覆盖 LOCKED 记录（仍然创建新版本）
   */
  force_replan?: boolean;
}

/**
 * ReplanFilmIRRequest — 基于已有 FilmIR id 重新规划
 */
export interface ReplanFilmIRRequest extends Omit<PlanFilmIRRequest, 'scene_id'> {
  /** 基于哪个 FilmIR 的版本信息进行递增重建 */
  base_film_ir_id: string;
}

// ==================================================================
// LLM 结构化输出 Schema（LLM 必须返回此 JSON 结构）
// ==================================================================

/**
 * Film IR 最小字段集（P2-1 要求 LLM 输出，全部为必填或带 fallback）
 *
 * 注：LLM 以 JSON 格式输出此结构，后端用 FilmIROutputValidator 校验
 */
export interface FilmIRDraftFields {
  /** 戏剧功能 — 必填，合法枚举值见 VALID_DRAMATIC_FUNCTIONS */
  dramatic_function: DramaticFunctionEnum | string;

  /** 戏剧目标 — 必填，自由文本 */
  dramatic_goal: string;

  /** 情绪体验目标 — 必填（如 "压迫感→窒息→短暂释放"）*/
  emotional_target: string;

  /** 视角人物 characterId — 可为 null（无明确 POV）*/
  pov_character: string | null;

  /** 观众信息模式 — 合法枚举，可 null */
  audience_information_mode: string | null;

  /** 总体视觉策略描述 — 必填 */
  visual_strategy: string;

  /** 调度/走位策略 — 必填 */
  blocking_strategy: string;

  /** 镜头模式 — 合法枚举，必填 */
  shot_pattern: string;

  /** 平均镜头时长建议（秒）— 必填，正数 */
  avg_shot_length: number;

  /** 摄影机运动风格 — 合法枚举，必填 */
  camera_motion_style: string;

  /** 构图风格描述 — 必填 */
  composition_style: string;

  /** 光线风格 — 合法枚举，必填 */
  lighting_style: string;

  /** 色彩策略描述 — 必填 */
  color_strategy: string;

  /** 声音设计策略 — 必填 */
  sound_strategy: string;

  /** 连续性约束（JSON，可为空对象）*/
  continuity_constraints: Record<string, unknown>;

  /** 为何选择这个导演策略（决策溯源）— 必填 */
  why_this_choice: string;

  /** 被拒绝的替代方案及原因 — 必填 */
  alternative_rejected_reason: string;
}

// ==================================================================
// 响应 DTO
// ==================================================================

/** Planner 调用结果（无论 dry_run 还是 save_as_draft 均返回此结构）*/
export interface PlanFilmIRResponse {
  /** 此次规划是否为 dry_run（dry_run = true 时 film_ir_id 为 null）*/
  dry_run: boolean;

  /**
   * 写入 DB 的 FilmIR id（dry_run 时为 null）
   * save_as_draft 成功时非 null
   */
  film_ir_id: string | null;

  /** 规划字段（未经校验的 LLM 原始输出）*/
  draft_fields: FilmIRDraftFields;

  /** 结构化校验结果 */
  validation: FilmIRValidationResult;

  /** Planner 执行元数据 */
  planner_meta: PlannerMeta;
}

/** 结构化输出校验结果 */
export interface FilmIRValidationResult {
  /** 校验是否通过（false 时不写 DB）*/
  valid: boolean;

  /** 错误列表（字段级别）*/
  errors: FilmIRValidationError[];

  /** 警告列表（不阻断，但记录证据）*/
  warnings: FilmIRValidationWarning[];
}

export interface FilmIRValidationError {
  field: string;
  message: string;
  received?: unknown;
}

export interface FilmIRValidationWarning {
  field: string;
  message: string;
  fallback_applied?: string;
}

/** 执行元数据（provider 信息，用于 evidence 落盘）*/
export interface PlannerMeta {
  provider: string;         // 'openai' | 'claude' | 'gemini' | 'mock'
  model: string;            // 'gpt-4o-mini' | etc.
  prompt_tokens?: number;
  completion_tokens?: number;
  latency_ms: number;
  planner_version: string;
  executed_at: string;      // ISO 8601
}
