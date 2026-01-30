import { Injectable, Logger } from '@nestjs/common';
import { EngineInvokerHubService } from '../engine-hub/engine-invoker-hub.service';
import { EngineInvokeStatus } from '@scu/shared-types';
import * as path from 'path';

/**
 * G5SubengineHubService
 *
 * 职责：编排 G5 P0 级子引擎 (Dialogue -> Motion -> Layering)
 * 目标：生成“纯计划驱动”的 G5 Content Manifest
 */

@Injectable()
export class G5SubengineHubService {
  private readonly logger = new Logger(G5SubengineHubService.name);

  constructor(private readonly invokerHub: EngineInvokerHubService) {}

  /**
   * 执行 G5 全链路计划生成
   */
  async generateG5Manifest(payload: {
    story: any;
    renderPlan: any;
    outputDir: string;
    projectId: string;
    traceId: string;
  }) {
    this.logger.log(`[G5-HUB] Starting content sealing for project: ${payload.projectId}`);

    // 1. Dialogue Binding
    const dialogueResult = await this.invokerHub.invoke({
      engineKey: 'g5_dialogue_binding',
      payload: {
        story: payload.story,
        renderPlan: payload.renderPlan,
        outputDir: payload.outputDir,
      },
      metadata: { traceId: payload.traceId, projectId: payload.projectId },
    });

    if (!dialogueResult.success)
      throw new Error(`G5_DIALOGUE failed: ${dialogueResult.error?.message}`);

    // 2. Semantic Motion
    const motionResult = await this.invokerHub.invoke({
      engineKey: 'g5_semantic_motion',
      payload: {
        renderPlan: payload.renderPlan,
        outputDir: payload.outputDir,
      },
      metadata: { traceId: payload.traceId, projectId: payload.projectId },
    });

    if (!motionResult.success) throw new Error(`G5_MOTION failed: ${motionResult.error?.message}`);

    // 3. Asset Layering
    const layeringResult = await this.invokerHub.invoke({
      engineKey: 'g5_asset_layering',
      payload: {
        renderPlan: payload.renderPlan,
        outputDir: payload.outputDir,
      },
      metadata: { traceId: payload.traceId, projectId: payload.projectId },
    });

    if (!layeringResult.success)
      throw new Error(`G5_LAYERING failed: ${layeringResult.error?.message}`);

    this.logger.log(`[G5-HUB] Successfully sealed manifest at: ${payload.outputDir}`);

    return {
      dialogue_plan: dialogueResult.output,
      motion_plan: motionResult.output,
      layering_plan: layeringResult.output,
      staged_dir: payload.outputDir,
    };
  }
}
