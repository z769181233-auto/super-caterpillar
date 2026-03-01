import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { env, PRODUCTION_MODE } from '@scu/config';
import { EngineConfigStoreService } from './engine-config-store.service';
import { EngineRoutingService } from './engine-routing.service';
import { EngineStrategyService } from './engine-strategy.service';

/**
 * Engine Registry
 * 引擎注册表，管理所有可用的引擎适配器
 *
 * 【重要】本文件为唯一权威的 EngineRegistry 实现，其它位置的旧实现视为废弃。
 *
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章
 * 参考《毛毛虫宇宙_模型宇宙说明书_ModelUniverseSpec_V1.0》中与引擎注册相关的部分
 */
@Injectable()
export class EngineRegistry {
  private readonly logger = new Logger(EngineRegistry.name);
  private adapters: Map<string, EngineAdapter> = new Map();
  private aliasedKeys: Map<string, string> = new Map(); // S4-P1: Track alias replacements
  private defaultEngineKey: string;
  private jsonConfigMap: Map<string, any> = new Map();

  /**
   * 防御式初始化，避免在工厂/热重载/反序列化等场景下出现未初始化的 Map
   */
  private ensureAdapters() {
    if (!this.adapters) {
      this.adapters = new Map();
    }
    return this.adapters;
  }

  private safeLog(message: string) {
    try {
      this.logger?.log?.(message);
      return;
    } catch {
      // fallthrough
    }
    try {
      // eslint-disable-next-line no-console
      this.logger.log(message);
    } catch {
      // ignore
    }
  }

  constructor(
    private readonly engineConfigStore: EngineConfigStoreService,
    private readonly engineRoutingService: EngineRoutingService,
    @Inject(forwardRef(() => EngineStrategyService))
    private readonly engineStrategyService?: EngineStrategyService // S4-B: 策略路由层（可选，向后兼容）
  ) {
    // 默认引擎标识，可以通过环境变量配置
    this.defaultEngineKey = (env as any).engineDefault || 'default_novel_analysis';
  }

  /**
   * 获取 engines.json 中的配置（带缓存）
   */
  private getJsonConfig(engineKey: string): any | undefined {
    if (this.jsonConfigMap.has(engineKey)) {
      return this.jsonConfigMap.get(engineKey);
    }
    const cfg = this.engineConfigStore.getJsonConfig(engineKey);
    if (cfg) {
      this.jsonConfigMap.set(engineKey, cfg);
    }
    return cfg;
  }

  /**
   * 解析最终配置：DB > JSON（NOVEL_ANALYSIS 保持 JSON 不变）
   */
  async resolveEngineConfig(engineKey: string): Promise<any | null> {
    // 对于 NOVEL_ANALYSIS 维持原 JSON 配置（不可被 DB 覆盖）
    if (engineKey === 'default_novel_analysis') {
      return this.getJsonConfig(engineKey) || null;
    }

    const jsonCfg = this.getJsonConfig(engineKey);
    const dbCfg = await this.engineConfigStore.findByEngineKey(engineKey);
    return this.engineConfigStore.mergeConfig(dbCfg, jsonCfg) || jsonCfg || null;
  }

  /**
   * 暴露版本化配置解析：EngineRegistry 对外统一入口
   */
  async resolveEngineConfigWithVersion(
    engineKey: string,
    engineVersion?: string
  ): Promise<any | null> {
    // NOVEL_ANALYSIS 仍只走 JSON
    if (engineKey === 'default_novel_analysis') {
      return this.getJsonConfig(engineKey) || null;
    }
    return this.engineConfigStore.resolveEngineConfig(engineKey, engineVersion);
  }

  /**
   * 注册引擎适配器
   * @param adapter 适配器实例
   */
  register(adapter: EngineAdapter): void {
    if (!adapter.name) {
      throw new Error('EngineAdapter must have a name');
    }

    this.ensureAdapters().set(adapter.name, adapter);
    this.safeLog(`Registered engine adapter: ${adapter.name}`);
  }

  /**
   * 注册引擎适配器别名
   * @param alias 别名
   * @param adapter 适配器实例
   */
  registerAlias(alias: string, adapter: EngineAdapter): void {
    this.ensureAdapters().set(alias, adapter);
    this.aliasedKeys.set(alias, adapter.name); // S4-P1: Store original mapping
    this.safeLog(`Registered engine adapter alias: ${alias} -> ${adapter.name}`);
  }

  /**
   * 获取引擎适配器
   * @param engineKey 引擎标识
   * @returns EngineAdapter 或 null
   */
  getAdapter(engineKey: string): EngineAdapter | null {
    return this.ensureAdapters().get(engineKey) || null;
  }

  /**
   * 获取默认引擎适配器
   * @returns EngineAdapter 或 null
   */
  getDefaultAdapter(): EngineAdapter | null {
    return this.getAdapter(this.defaultEngineKey);
  }

  /**
   * 查找适配器（优先使用指定引擎，找不到则回退到默认）
   * 参考《毛毛虫宇宙_模型宇宙说明书_ModelUniverseSpec_V1.0》：引擎版本管理
   *
   * @param engineKey 引擎标识（可选）
   * @param jobType Job 类型（可选，用于查找默认适配器）
   * @param payload Job 负载数据（可选，用于 feature flag 判断）
   * @returns EngineAdapter
   * @throws Error 如果找不到适配器
   */
  findAdapter(engineKey?: string, jobType?: string, payload?: any): EngineAdapter {
    // S3-A.3 阶段 1：可选 feature flag 支持（useHttpEngine）
    // 只有在 payload?.useHttpEngine === true 时才尝试强制使用 HTTP 引擎
    if (payload?.useHttpEngine === true) {
      const httpEngineKey = payload?.engineKey || 'http_gemini_v1';
      const adapter = this.getAdapter(httpEngineKey);
      if (adapter && adapter.supports(httpEngineKey)) {
        return adapter;
      }
      // 如果指定的 HTTP 引擎不存在，继续走原有逻辑（不抛出错误）
    }

    this.safeLog(
      `[DEBUG] findAdapter request: engineKey=${engineKey}, jobType=${jobType}. Available adapters: ${Array.from(this.adapters.keys()).join(', ')}`
    );

    // 1. 如果指定了 engineKey，优先查找
    if (engineKey) {
      const adapter = this.getAdapter(engineKey);
      if (adapter) {
        // 检查适配器是否支持该 engineKey
        if (adapter.supports(engineKey)) {
          return adapter;
        }
      }
    }

    // 2. 根据 jobType 查找默认适配器
    if (jobType) {
      const defaultKeyForJobType = this.getDefaultEngineKeyForJobType(jobType);
      if (defaultKeyForJobType) {
        const adapter = this.getAdapter(defaultKeyForJobType);
        if (adapter && adapter.supports(defaultKeyForJobType)) {
          return adapter;
        }
      }
    }

    // 3. 回退到全局默认引擎
    const defaultAdapter = this.getDefaultAdapter();
    if (defaultAdapter) {
      return defaultAdapter;
    }

    throw new Error(
      `No engine adapter found for engineKey="${engineKey || 'undefined'}" jobType="${jobType || 'undefined'}"`
    );
  }

  /**
   * 根据 JobType 获取默认引擎标识
   * @param jobType Job 类型
   * @returns 默认引擎标识
   */
  getDefaultEngineKeyForJobType(jobType: string): string | null {
    // 根据 JobType 映射到默认引擎标识
    // 注意：NOVEL_ANALYSIS 继续使用本地 Adapter，不切换到 HTTP
    const jobTypeToEngineKey: Record<string, string> = {
      // 现有 JobType（保持不变，禁止修改）
      NOVEL_ANALYSIS: 'default_novel_analysis', // 本地 Adapter
      NOVEL_ANALYZE_CHAPTER: 'default_novel_analysis', // Same engine for chapter analysis
      SHOT_RENDER: PRODUCTION_MODE ? 'real_shot_render' : 'default_shot_render',

      // HTTP 版本指向真实引擎
      NOVEL_ANALYSIS_HTTP: 'http_real_novel_analysis',
      SHOT_RENDER_HTTP: 'http_real_shot_render',
      VIDEO_RENDER: 'video_merge',

      // P2 Visual Metrics
      CE03_VISUAL_DENSITY: 'ce03_visual_density',
      CE04_VISUAL_ENRICHMENT: 'ce04_visual_enrichment',
      CE06_NOVEL_PARSING: 'ce06_novel_parsing',
      CE07_MEMORY_UPDATE: 'ce07_memory_update',
      CE01_REFERENCE_SHEET: 'character_visual',
      TIMELINE_PREVIEW: 'ce11_timeline_preview',
      PIPELINE_STAGE1_NOVEL_TO_VIDEO: 'stage1_orchestrator',
      CE09_MEDIA_SECURITY: 'ce09_security_real',

      CE11_SHOT_GENERATOR: 'ce11_shot_generator_mock', // Default to Mock
      CE11_SHOT_GENERATOR_REAL: 'ce11_shot_generator_real', // Explicit Real
      CE14_NARRATIVE_CLIMAX: 'ce14_narrative_climax',

      AUDIO: 'audio_engine', // Added for dual-track integration
    };

    return jobTypeToEngineKey[jobType] || null;
  }

  /**
   * Stage3-A: 根据 JobType 解析 Engine（静态映射）
   * @param jobType Job 类型
   * @returns Engine 对象或 null
   */
  async resolveEngineForJobType(
    jobType: string
  ): Promise<{ id: string; code: string; name: string; type: string; isActive: boolean } | null> {
    const engineKey = this.getDefaultEngineKeyForJobType(jobType);
    if (!engineKey) {
      return null;
    }

    // 从配置存储中查找 Engine（必须从 DB 查找，禁止 JSON fallback）
    const engineConfig = await this.engineConfigStore.findByEngineKey(engineKey);
    if (!engineConfig) {
      // Stage3-A 最小闭环：Engine 必须落库，避免伪 engineId 破坏绑定一致性
      return null;
    }

    // 从 DB 配置构造 Engine 对象（最小字段）
    // 兼容现有字段：engineKey -> code, adapterName -> name, adapterType -> type, enabled -> isActive
    return {
      id: engineConfig.id,
      code: engineConfig.code || engineConfig.engineKey || engineConfig.id,
      name: engineConfig.name || engineConfig.adapterName || engineConfig.engineKey,
      type: engineConfig.type || engineConfig.adapterType || 'local',
      isActive: (engineConfig.isActive !== false && engineConfig.enabled !== false) || true,
    };
  }

  /**
   * 获取所有已注册的引擎名称
   */
  getAllEngineNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 调用引擎（统一入口）
   * @param input 调用输入
   * @returns 调用结果
   */
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const jobType = input.jobType || '';
    const payload = input.payload || {};

    // 1) 计算 baseEngineKey：优先用 input.engineKey，否则用现有 getDefaultEngineKeyForJobType
    const baseEngineKey = input.engineKey || this.getDefaultEngineKeyForJobType(jobType) || null;

    // 2) S4-B: 通过策略层决定最终 engineKey / resolvedVersion
    // 如果策略层可用，使用策略层；否则直接使用路由层（向后兼容）
    let routingResult: { engineKey: string | null; resolvedVersion?: string | null };
    if (this.engineStrategyService) {
      const strategyDecision = this.engineStrategyService.decideStrategy(
        jobType,
        payload,
        baseEngineKey,
        {
          // 可以从 input 中提取更多上下文信息（如果有）
          // projectId: (input as any).projectId, // 暂时不传递，后续扩展
        }
      );
      routingResult = {
        engineKey: strategyDecision.engineKey,
        resolvedVersion: strategyDecision.resolvedVersion,
      };
    } else {
      // 向后兼容：直接使用路由层
      routingResult = this.engineRoutingService.resolve({
        jobType,
        baseEngineKey,
        payload,
      });
    }

    const finalEngineKey = routingResult.engineKey || baseEngineKey || this.defaultEngineKey;

    // S4-P1: Production Alias Blocking Assert
    const productionCriticalEngines = [
      'ce10_timeline_preview',
      'ce11_shot_generator_real',
      'shot_render',
      'real_shot_render',
      'video_merge',
    ];
    const isProductionJob =
      input.context?.stage === 'production' ||
      input.payload?.metadata?.stage === 'production' ||
      input.payload?.stage === 'production' ||
      PRODUCTION_MODE;

    const originalKey = this.aliasedKeys.get(finalEngineKey);
    if (isProductionJob && originalKey && productionCriticalEngines.includes(finalEngineKey)) {
      if (originalKey !== finalEngineKey) {
        this.logger.error(
          `[P1_BLOCKER] Production Engine Risk: ${finalEngineKey} is aliased to ${originalKey}. Blocked.`
        );
        throw new Error(
          `PRODUCTION_PATH_ASSERT_FAILED: Engine ${finalEngineKey} is an alias and cannot be used in production.`
        );
      }
    }

    // 3) 合成 payload：如果路由层给出了 resolvedVersion 且 payload 里没有 engineVersion，则补上
    const nextPayload: any = {
      ...payload,
    };
    if (routingResult.resolvedVersion && !nextPayload.engineVersion) {
      nextPayload.engineVersion = routingResult.resolvedVersion;
    }

    const nextInput: EngineInvokeInput = {
      ...input,
      engineKey: finalEngineKey,
      payload: nextPayload,
    };

    // 4) 选择 adapter（保留现有 findAdapter 行为和内部兼容逻辑）
    const adapter = this.findAdapter(nextInput.engineKey, nextInput.jobType, nextInput.payload);

    // 5) 调用 adapter.invoke（适配器内部仍使用 EngineConfigService/EngineConfigStore 读取配置）
    return adapter.invoke(nextInput);
  }
}
