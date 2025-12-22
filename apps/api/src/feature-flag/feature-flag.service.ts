import { Injectable, Logger } from '@nestjs/common';

/**
 * Feature Flag Service
 * 
 * 用途：控制 Stage 11 新特性的启用/禁用
 * 配置：通过环境变量控制，支持动态调整
 */
@Injectable()
export class FeatureFlagService {
    private readonly logger = new Logger(FeatureFlagService.name);


    /**
     * 检查指定 Feature Flag 是否启用 (支持 Stage 12 多级策略)
     * @param flagName Flag 名称（环境变量名）
     * @param context 上下文信息 (Org/Project/User)
     * @returns true 表示启用，false 表示禁用
     */
    isEnabled(flagName: string, context?: { orgId?: string, projectId?: string, userId?: string }): boolean {
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
                const allowed = orgWhitelist.split(',').map(s => s.trim()).filter(Boolean);
                if (allowed.includes(context.orgId)) {
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Org Whitelist for ${context.orgId}`);
                    return true;
                }
            }
        }

        // 3. Project Whitelist Strategy
        if (context.projectId) {
            const projectWhitelist = process.env[`${flagName}_PROJECT_WHITELIST`];
            if (projectWhitelist) {
                const allowed = projectWhitelist.split(',').map(s => s.trim()).filter(Boolean);
                if (allowed.includes(context.projectId)) {
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Project Whitelist for ${context.projectId}`);
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
                    this.logger.debug(`Feature flag ${flagName} ENABLED via Percentage (${percentage}%) for ${context.userId}`);
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
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
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
        ];

        const flags: Record<string, boolean> = {};
        for (const flagName of knownFlags) {
            flags[flagName] = this.isEnabled(flagName);
        }

        return flags;
    }
}
