import { Injectable } from '@nestjs/common';
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
    context?: StrategyContext,
  ): StrategyDecision {
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

