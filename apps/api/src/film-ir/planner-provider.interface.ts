/**
 * FilmIR Planner Provider 接口（P2-1）
 *
 * 解耦 LLM 调用层与 FilmIR 协议层的抽象界面。
 * 后续可替换 provider（OpenAI / Claude / Gemini / Mock）
 * 而不影响 FilmIRPlannerService 的业务逻辑。
 */

import type { FilmIRDraftFields, PlannerMeta } from './dto/plan-film-ir.dto';

/**
 * Planner 调用入参（内部格式，由 PlannerService 组装后传入 Provider）
 */
export interface PlannerInvokeInput {
  /** 场景原文 */
  sourceText: string;

  /** 上下文摘要（前后章节信息）*/
  contextSummary?: string;

  /** 用户预设戏剧目标（可选）*/
  dramaticGoal?: string;

  /** 入场前人物关系 */
  relationshipBefore?: string;

  /** 出场后人物关系 */
  relationshipAfter?: string;

  /** planner 版本标识（用于 prompt 路由）*/
  plannerVersion: string;
}

/**
 * Planner 调用结果（Provider 返回给 PlannerService）
 */
export interface PlannerInvokeResult {
  /** LLM 输出的结构化字段（未经 FilmIR 层校验）*/
  draftFields: FilmIRDraftFields;

  /** 执行元数据 */
  meta: PlannerMeta;

  /** LLM 原始输出（用于 evidence 落盘和 debug）*/
  rawOutput: string;
}

/**
 * FilmIR Planner Provider 接口
 *
 * 所有 LLM provider adapter 必须实现此接口。
 * 不允许在 Provider 内部抛出业务异常（只抛底层错误），
 * 业务校验由 FilmIROutputValidator 统一完成。
 */
export interface IPlannerProvider {
  /**
   * Provider 标识符（用于 evidence 记录）
   * 例如：'openai', 'claude', 'gemini', 'mock'
   */
  readonly providerId: string;

  /**
   * 默认模型名称
   */
  readonly modelId: string;

  /**
   * 调用 LLM 规划 Film IR
   * @throws Error — 仅在网络/API 级别失败时抛出
   */
  invoke(input: PlannerInvokeInput): Promise<PlannerInvokeResult>;
}

// ==================================================================
// Mock Provider（用于测试和 dry-run 功能验证）
// ==================================================================

/**
 * Mock Planner Provider
 *
 * 用于：
 * 1. P2-1 dry-run 功能验证（不依赖真实 LLM API Key）
 * 2. 单元测试（替代真实 LLM 调用）
 * 3. 开发环境预览
 *
 * 生产环境：由 feature flag 'planner_provider' 控制，
 * 默认使用 OpenAIPlannerProvider
 */
export class MockPlannerProvider implements IPlannerProvider {
  readonly providerId = 'mock';
  readonly modelId = 'mock-model-v1';

  async invoke(input: PlannerInvokeInput): Promise<PlannerInvokeResult> {
    const startedAt = Date.now();

    const draftFields: import('./dto/plan-film-ir.dto').FilmIRDraftFields = {
      dramatic_function: 'CONFLICT',
      dramatic_goal: `[MOCK] 基于场景文本「${input.sourceText.slice(0, 30)}...」的模拟导演规划`,
      emotional_target: '压迫感 → 紧张对峙 → 短暂呼吸',
      pov_character: null,
      audience_information_mode: 'DRAMATIC_IRONY',
      visual_strategy: '[MOCK] 近景主导，强调面部表情与微反应',
      blocking_strategy: '[MOCK] 角色保持静态对立，空间压缩营造冲突感',
      shot_pattern: 'CLOSE_UP_DOMINANT',
      avg_shot_length: 3.5,
      camera_motion_style: 'STATIC',
      composition_style: '三等分构图，人物位于张力轴两端',
      lighting_style: 'LOW_KEY',
      color_strategy: '[MOCK] 冷蓝调，低饱和，突出阴影区域',
      sound_strategy: '[MOCK] 环境音渐弱，对话主导，刻意留白',
      continuity_constraints: {
        mustMatch: ['character_costume', 'location'],
        canChange: ['expression', 'posture'],
      },
      why_this_choice: '[MOCK] 基于剧本冲突强度评估，选择近景主导方案以强化情绪冲击',
      alternative_rejected_reason: '[MOCK] 宽景方案被拒绝，因其会分散冲突焦点',
    };

    const latency = Date.now() - startedAt;

    return {
      draftFields,
      meta: {
        provider: this.providerId,
        model: this.modelId,
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms: latency,
        planner_version: input.plannerVersion,
        executed_at: new Date().toISOString(),
      },
      rawOutput: JSON.stringify(draftFields),
    };
  }
}
