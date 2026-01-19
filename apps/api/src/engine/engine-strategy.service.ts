import { Injectable, BadRequestException } from '@nestjs/common';
import { EngineRoutingService } from './engine-routing.service';

/**
 * S4-B: 策略路由层
 *
 * 在现有 EngineRoutingService 之上增加策略层，支持：
 * - 基于成本/质量/速度的规则路由
 * - A/B 实验与灰度分发
 * - 智能选型（后续扩展）
 *
 * 当前版本：默认透传实现，不改变现有行为
 */

export interface StrategyContext {
  projectId?: string;
  tenantId?: string;
  experimentId?: string;
  experimentGroup?: 'A' | 'B' | 'control';
  [key: string]: any;
}

export interface StrategyDecision {
  engineKey: string | null;
  resolvedVersion?: string | null;
  strategyLabel?: string; // 策略标签，用于追踪和审计
  experimentId?: string; // 实验 ID（如果有）
  experimentGroup?: 'A' | 'B' | 'control'; // 实验组（如果有）
}

@Injectable()
export class EngineStrategyService {
  constructor(private readonly engineRoutingService: EngineRoutingService) {}

  /**
   * 策略决策：根据上下文生成引擎选择建议
   *
   * 当前版本：默认透传到 EngineRoutingService，不改变现有行为
   * 后续版本：将在此处实现规则路由、A/B 实验等策略
   *
   * @param jobType Job 类型
   * @param payload Job payload
   * @param baseEngineKey 基础引擎标识（可选）
   * @param context 策略上下文（可选）
   * @returns 策略决策结果
   */
  decideStrategy(
    jobType: string | null,
    payload: any,
    baseEngineKey?: string | null,
    context?: StrategyContext
  ): StrategyDecision {
    // P5-0.1: CE11 Strict Engine Key Enforcement (No Silent Mock in Production)
    if (jobType === 'CE11_SHOT_GENERATOR') {
      const isVerification = payload?.isVerification === true || payload?.gateMode === true;
      // Note: baseEngineKey is from input.engineKey. payload.engineKey might be legacy.
      const explicitEngineKey = baseEngineKey || payload?.engineKey || payload?.engine;

      if (!isVerification && !explicitEngineKey) {
        throw new BadRequestException(
          'CE11_SHOT_GENERATOR requires explicit engineKey in production (e.g. ce11_shot_generator_real)'
        );
      }

      // If in verification mode and no key provided, default to mock (as per requirement)
      if (isVerification && !explicitEngineKey) {
        return {
          engineKey: 'ce11_shot_generator_mock',
          resolvedVersion: null,
          strategyLabel: 'p5_verification_fallback',
        };
      }
    }

    // S4-B Phase 1: 默认透传实现，不改变现有行为
    // 直接调用 EngineRoutingService，保持与 Stage3 完全一致的行为
    const routingResult = this.engineRoutingService.resolve({
      jobType,
      baseEngineKey,
      payload,
    });

    return {
      engineKey: routingResult.engineKey,
      resolvedVersion: routingResult.resolvedVersion,
      strategyLabel: 'default', // 默认策略标签
    };
  }
}
