import axios, { AxiosError } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import type { IPlannerProvider, PlannerInvokeInput, PlannerInvokeResult } from '../planner-provider.interface';
import type { FilmIRDraftFields } from '../dto/plan-film-ir.dto';

/**
 * OpenAI Planner Provider（P2.2）
 *
 * 使用 axios 直接调用 OpenAI Chat Completions REST API。
 *
 * 保护机制：
 * 1. 超时保护（FILM_IR_PLANNER_TIMEOUT_MS，默认 30s）
 * 2. 限流重试（429 → 自动读取 retry-after 等待）
 * 3. 空响应保护（content 为 null 视为失败）
 * 4. JSON 解析失败保护（rawOutput 完整记录）
 * 5. token usage 记录（用于 evidence 落盘）
 *
 * 环境配置（packages/config/src/env.ts）：
 * - FILM_IR_PLANNER_PROVIDER=openai
 * - OPENAI_API_KEY=sk-xxx
 * - FILM_IR_PLANNER_MODEL=gpt-4o-mini（默认）
 * - FILM_IR_PLANNER_TIMEOUT_MS=30000（默认）
 * - FILM_IR_PLANNER_MAX_RETRIES=2（默认）
 */
@Injectable()
export class OpenAIPlannerProvider implements IPlannerProvider {
  private readonly logger = new Logger(OpenAIPlannerProvider.name);

  readonly providerId = 'openai';

  constructor(
    private readonly apiKey: string,
    readonly modelId: string = 'gpt-4o-mini',
    private readonly timeoutMs: number = 30000,
    private readonly maxRetries: number = 2,
  ) {
    this.logger.log(
      `[OpenAIPlanner] 初始化: model=${this.modelId} timeout=${this.timeoutMs}ms maxRetries=${this.maxRetries}`,
    );
  }

  async invoke(input: PlannerInvokeInput): Promise<PlannerInvokeResult> {
    const startedAt = Date.now();

    const requestBody = {
      model: this.modelId,
      messages: [
        { role: 'system', content: this.buildSystemPrompt() },
        { role: 'user', content: this.buildUserPrompt(input) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'film_ir_draft',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              dramatic_function: { type: 'string', enum: ['CONFLICT','REVELATION','TENSION_BUILD','RESOLUTION','SETUP','TURNING_POINT','CHARACTER_DEVELOPMENT','EXPOSITION'] },
              dramatic_goal: { type: 'string' },
              emotional_target: { type: 'string' },
              pov_character: { type: ['string', 'null'] },
              audience_information_mode: { type: ['string', 'null'], enum: ['DRAMATIC_IRONY','SUSPENSE','MYSTERY','OMNISCIENT','LIMITED_POV', null] },
              visual_strategy: { type: 'string' },
              blocking_strategy: { type: 'string' },
              shot_pattern: { type: 'string', enum: ['CLOSE_UP_DOMINANT','WIDE_ESTABLISH','PARALLEL_EDIT','POV_SUBJECTIVE','MONTAGE','LONG_TAKE','MIXED'] },
              avg_shot_length: { type: 'number', minimum: 0.5, maximum: 60 },
              camera_motion_style: { type: 'string', enum: ['STATIC','HANDHELD','SMOOTH_CRANE','TRACKING','DOLLY','AERIAL','MIXED'] },
              composition_style: { type: 'string' },
              lighting_style: { type: 'string', enum: ['HIGH_KEY','LOW_KEY','CHIAROSCURO','NATURAL','MOTIVATED','DOCUMENTARY'] },
              color_strategy: { type: 'string' },
              sound_strategy: { type: 'string' },
              continuity_constraints: { type: 'object', additionalProperties: true },
              why_this_choice: { type: 'string' },
              alternative_rejected_reason: { type: 'string' },
            },
            required: ['dramatic_function','dramatic_goal','emotional_target','pov_character','audience_information_mode','visual_strategy','blocking_strategy','shot_pattern','avg_shot_length','camera_motion_style','composition_style','lighting_style','color_strategy','sound_strategy','continuity_constraints','why_this_choice','alternative_rejected_reason'],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.3,
    };


    let rawOutput = '';
    let promptTokens = 0;
    let completionTokens = 0;

    // 带重试的 axios 调用
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          requestBody,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: this.timeoutMs,
          },
        );

        const choice = response.data?.choices?.[0];
        rawOutput = choice?.message?.content ?? '';
        promptTokens = response.data?.usage?.prompt_tokens ?? 0;
        completionTokens = response.data?.usage?.completion_tokens ?? 0;

        if (!rawOutput || rawOutput.trim() === '') {
          throw new Error('OpenAI 返回空响应 (content=null or empty)');
        }

        break; // 成功，退出重试循环

      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;

        // 429 限流：读取 retry-after 等待
        if (status === 429 && attempt < this.maxRetries) {
          const retryAfter = Number(axiosErr.response?.headers?.['retry-after'] ?? 5);
          this.logger.warn(`[OpenAIPlanner] 限流 (429)，${retryAfter}s 后重试 (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(retryAfter * 1000);
          lastError = err instanceof Error ? err : new Error(String(err));
          continue;
        }

        // 其他错误：直接抛出
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[OpenAIPlanner] API 调用失败 (attempt ${attempt + 1}): ${message}`);
        throw err;
      }
    }

    if (lastError && !rawOutput) {
      throw lastError;
    }

    // JSON 解析保护
    let parsed: Partial<FilmIRDraftFields>;
    try {
      parsed = JSON.parse(rawOutput) as Partial<FilmIRDraftFields>;
    } catch (parseErr) {
      this.logger.error(`[OpenAIPlanner] JSON 解析失败, rawOutput 前200字: ${rawOutput.slice(0, 200)}`);
      throw new Error(`OpenAI 输出 JSON 解析失败: ${(parseErr as Error).message}`);
    }

    const latency = Date.now() - startedAt;
    this.logger.log(
      `[OpenAIPlanner] 调用成功: latency=${latency}ms promptTokens=${promptTokens} completionTokens=${completionTokens}`,
    );

    return {
      draftFields: parsed as FilmIRDraftFields,
      meta: {
        provider: this.providerId,
        model: this.modelId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        latency_ms: latency,
        planner_version: input.plannerVersion,
        executed_at: new Date().toISOString(),
      },
      rawOutput,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildSystemPrompt(): string {
    return `你是一位经验丰富的电影导演，负责为剧本场景设计详细的导演意图与视觉规划。

你必须以 JSON 格式输出，包含以下字段（全部必填，除非说明可为 null）：

{
  "dramatic_function": "枚举: CONFLICT|REVELATION|TENSION_BUILD|RESOLUTION|SETUP|TURNING_POINT|CHARACTER_DEVELOPMENT|EXPOSITION",
  "dramatic_goal": "场景核心戏剧目标，自由文本，非空",
  "emotional_target": "观众应感受的情绪体验，如'压迫感→窒息→短暂释放'",
  "pov_character": "主视角角色名 或 null",
  "audience_information_mode": "枚举: DRAMATIC_IRONY|SUSPENSE|MYSTERY|OMNISCIENT|LIMITED_POV 或 null",
  "visual_strategy": "整体视觉策略描述，非空",
  "blocking_strategy": "演员调度与走位策略，非空",
  "shot_pattern": "枚举: CLOSE_UP_DOMINANT|WIDE_ESTABLISH|PARALLEL_EDIT|POV_SUBJECTIVE|MONTAGE|LONG_TAKE|MIXED",
  "avg_shot_length": "正数，0.5~60之间的秒数",
  "camera_motion_style": "枚举: STATIC|HANDHELD|SMOOTH_CRANE|TRACKING|DOLLY|AERIAL|MIXED",
  "composition_style": "构图风格描述，非空",
  "lighting_style": "枚举: HIGH_KEY|LOW_KEY|CHIAROSCURO|NATURAL|MOTIVATED|DOCUMENTARY",
  "color_strategy": "色彩策略描述，非空",
  "sound_strategy": "声音设计策略，非空",
  "continuity_constraints": {},
  "why_this_choice": "决策溯源，非空",
  "alternative_rejected_reason": "被拒绝方案及原因，非空"
}

规则：仅输出 JSON，不要任何额外文字。枚举字段必须严格使用枚举值。`;
  }

  private buildUserPrompt(input: PlannerInvokeInput): string {
    const parts: string[] = [`【场景原文】\n${input.sourceText}`];

    if (input.contextSummary) parts.push(`【上下文摘要】\n${input.contextSummary}`);
    if (input.dramaticGoal) parts.push(`【预设戏剧目标】\n${input.dramaticGoal}`);
    if (input.relationshipBefore) parts.push(`【入场前人物关系】\n${input.relationshipBefore}`);
    if (input.relationshipAfter) parts.push(`【期望出场后人物关系】\n${input.relationshipAfter}`);

    parts.push('\n请输出完整的导演规划 JSON。');
    return parts.join('\n\n');
  }
}
