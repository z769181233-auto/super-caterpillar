import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Feature Flag Service
 *
 * 用途：控制 Stage 11 新特性的启用/禁用
 * 配置：通过环境变量控制，支持动态调整
 */
@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 检查指定 Feature Flag 是否启用 (支持 Stage 12 多级策略)
   * @param flagName Flag 名称（环境变量名）
   * @param context 上下文信息 (Org/Project/User)
   * @returns true 表示启用，false 表示禁用
   */
  isEnabled(
    flagName: string,
    context?: { orgId?: string; projectId?: string; userId?: string }
  ): boolean {
    // 1. 全局环境变量 (Priority 1: Global Force)
    const envValue = process.env[flagName];
    const isGlobalEnabled = ['true', '1', 'yes'].includes((envValue || '').toLowerCase());

    if (isGlobalEnabled) {
      this.logger.debug(`Feature flag ${flagName} GLOBALLY ENABLED`);
      return true;
    }

    // stage12-prod-governance: 若无上下文，仅看全局配置
    if (!context) {
      return false;
    }

    // 2. Org Whitelist Strategy
    if (context.orgId) {
      const orgWhitelist = process.env[`${flagName}_ORG_WHITELIST`];
      if (orgWhitelist) {
        const allowed = orgWhitelist
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (allowed.includes(context.orgId)) {
          this.logger.debug(
            `Feature flag ${flagName} ENABLED via Org Whitelist for ${context.orgId}`
          );
          return true;
        }
      }
    }

    // 3. Project Whitelist Strategy
    if (context.projectId) {
      const projectWhitelist = process.env[`${flagName}_PROJECT_WHITELIST`];
      if (projectWhitelist) {
        const allowed = projectWhitelist
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (allowed.includes(context.projectId)) {
          this.logger.debug(
            `Feature flag ${flagName} ENABLED via Project Whitelist for ${context.projectId}`
          );
          return true;
        }
      }
    }

    // 4. Percentage Strategy (Canary)
    // Requires userId for stable canary, or falls back to false if no unique ID provided
    const percentageStr = process.env[`${flagName}_PERCENTAGE`]; // 0-100
    if (percentageStr && context.userId) {
      const percentage = parseInt(percentageStr, 10);
      if (!isNaN(percentage)) {
        if (percentage <= 0) return false;
        if (percentage >= 100) {
          this.logger.debug(`Feature flag ${flagName} ENABLED via Percentage (>=100%)`);
          return true;
        }

        // CRC32 or simple hash modulo 100
        const hash = this.simpleHash(context.userId);
        if (hash % 100 < percentage) {
          this.logger.debug(
            `Feature flag ${flagName} ENABLED via Percentage (${percentage}%) for ${context.userId}`
          );
          return true;
        }
      }
    }

    return false;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 检查自动返工是否启用 (P14-0 灰度策略)
   * 优先 DB（org/project 配置），其次 env override，默认 OFF。
   */
  async isAutoReworkEnabled(context: { orgId?: string; projectId?: string }): Promise<boolean> {
    // 1. 检查环境变量 Override (Gate/Staging 强制启用/禁用)
    const envValue = process.env['FEATURE_AUTO_REWORK_ENABLED'];
    if (envValue) {
      const isEnvEnabled = ['true', '1', 'yes'].includes(envValue.toLowerCase());
      if (isEnvEnabled) return true;
    }

    // 2. 检查 DB 配置 (Project 级)
    if (context.projectId) {
      try {
        const project = await this.prisma.project.findUnique({
          where: { id: context.projectId },
          select: { settingsJson: true },
        });
        const settings = project?.settingsJson as Record<string, any>;
        if (
          settings?.autoReworkEnabled === true ||
          settings?.ce23RealEnabled === true ||
          settings?.ce23RealShadowEnabled === true
        ) {
          this.logger.debug(
            `Feature flag AUTO_REWORK/CE23 enabled via DB for project ${context.projectId}`
          );
          return true;
        }
      } catch (e) {
        this.logger.error(`Failed to check project feature flag: ${e.message}`);
      }
    }

    // 默认关闭
    return false;
  }

  /**
   * 获取所有已知 Feature Flags 的状态
   * @returns 包含所有 Flag 状态的对象
   * @note 仅反映“全局强制开关”状态，不包含灰度/白名单策略结果
   */
  getAllFlags(): Record<string, boolean> {
    const knownFlags = [
      'FEATURE_SIGNED_URL_ENFORCED',
      'FEATURE_TEXT_SAFETY_TRI_STATE',
      'FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT',
      'FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE',
      'FEATURE_AUTO_REWORK_ENABLED',
    ];

    const flags: Record<string, boolean> = {};
    for (const flagName of knownFlags) {
      flags[flagName] = this.isEnabled(flagName);
    }

    return flags;
  }
}
