import { Injectable } from '@nestjs/common';

interface EngineRoutingInput {
  jobType?: string | null;
  baseEngineKey?: string | null;
  payload?: any;
}

interface EngineRoutingResult {
  engineKey: string | null;
  resolvedVersion?: string | null;
}

/**
 * EngineRoutingService (RoutingLayer)
 *
 * 负责只做决策：选出 { engineKey, resolvedVersion }
 *
 * 规则：
 * 1. NOVEL_ANALYSIS 默认：除非显式要求 HTTP，否则必须走 default_novel_analysis
 * 2. payload.engineKey 显式指定时优先使用
 * 3. *_HTTP JobType：默认走 HTTP 引擎
 * 4. useHttpEngine === true：灰度切 HTTP
 * 5. 无特殊情况：返回 baseEngineKey（保持向后兼容）
 */
@Injectable()
export class EngineRoutingService {
  resolve(input: EngineRoutingInput): EngineRoutingResult {
    const jobType = input.jobType || '';
    const payload = input.payload || {};
    let engineKey = input.baseEngineKey || null;

    // 1) 如果 payload 显式指定了 engineKey，优先使用（在所有规则之前检查）
    if (payload.engineKey && typeof payload.engineKey === 'string') {
      engineKey = payload.engineKey;
      // 如果显式指定了 engineKey，直接返回（跳过其他规则）
      return {
        engineKey,
        resolvedVersion: payload.engineVersion ?? null,
      };
    }

    // 2) NOVEL_ANALYSIS 默认：除非显式要求 HTTP，否则必须走 default_novel_analysis
    if (jobType === 'NOVEL_ANALYSIS') {
      const useHttpEngine = payload.useHttpEngine === true;
      const isHttpJobType = jobType.endsWith('_HTTP'); // 这里其实为 false，只是为一致性保留
      if (!useHttpEngine && !isHttpJobType) {
        return {
          engineKey: 'default_novel_analysis',
          resolvedVersion: payload.engineVersion ?? null,
        };
      }
    }

    // 3) *_HTTP JobType：默认走 HTTP 引擎（baseEngineKey 已经是默认 HTTP 映射）
    const isHttpJobType = jobType.endsWith('_HTTP');
    if (isHttpJobType && engineKey) {
      return {
        engineKey,
        resolvedVersion: payload.engineVersion ?? null,
      };
    }

    // 4) 非 *_HTTP，但 useHttpEngine === true：灰度切 HTTP
    if (!isHttpJobType && payload.useHttpEngine === true) {
      // 基于 jobType 做最简单的 HTTP 选择（保持与现有映射语义一致）
      if (jobType === 'NOVEL_ANALYSIS') {
        engineKey = 'http_real_novel_analysis';
      } else if (jobType === 'SHOT_RENDER') {
        engineKey = 'http_real_shot_render';
      }
      // 其他 jobType 暂时不做强制切 HTTP，保留 baseEngineKey
    }

    // 5) 无特殊情况：返回 baseEngineKey（保持向后兼容）
    return {
      engineKey,
      resolvedVersion: payload.engineVersion ?? null,
    };
  }
}
