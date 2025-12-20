import { Injectable } from '@nestjs/common';

interface ResolveParams {
  jobType: string;
  payload?: any;
  /**
   * 由 EngineRegistry 提供的默认映射结果
   */
  defaultEngineKey?: string | null;
  /**
   * 对应 *_HTTP JobType 的默认映射结果（用于 useHttpEngine 灰度切换）
   */
  httpDefaultEngineKey?: string | null;
}

interface ResolveResult {
  engineKey: string;
  resolvedVersion?: string | null;
}

/**
 * EngineRoutingService
 * - 决定本次调用使用的 engineKey 与 resolvedVersion
 * - 不改变 NOVEL_ANALYSIS 默认行为（未显式开启 HTTP 时不可切换）
 * - 不修改封板逻辑与 EngineSpec 字段
 */
@Injectable()
export class EngineRoutingService {
  resolve(params: ResolveParams): ResolveResult {
    const { jobType, payload, defaultEngineKey, httpDefaultEngineKey } = params;
    const isHttpJob = jobType.endsWith('_HTTP');

    // 版本选择：仅决定 resolvedVersion，实际合并由 EngineConfigStore 处理
    const resolvedVersion = payload?.engineVersion ?? undefined;

    // 1) NOVEL_ANALYSIS 默认约束：未开启 useHttpEngine 且非 *_HTTP，必须走本地
    if (jobType === 'NOVEL_ANALYSIS' && payload?.useHttpEngine !== true && !isHttpJob) {
      return {
        engineKey: 'default_novel_analysis',
        resolvedVersion,
      };
    }

    // 2) 基础默认引擎（来自现有映射）
    let engineKey = defaultEngineKey || 'default_novel_analysis';

    // 3) *_HTTP JobType：使用对应 HTTP 映射
    if (isHttpJob && defaultEngineKey) {
      engineKey = defaultEngineKey;
    }

    // 4) 非 *_HTTP，但 useHttpEngine === true：允许灰度切 HTTP（使用 httpDefaultEngineKey）
    if (!isHttpJob && payload?.useHttpEngine === true && httpDefaultEngineKey) {
      engineKey = httpDefaultEngineKey;
    }

    // 5) payload.engineKey 显式覆盖（在允许范围内）
    if (payload?.engineKey) {
      engineKey = payload.engineKey;
    }

    return { engineKey, resolvedVersion };
  }
}

