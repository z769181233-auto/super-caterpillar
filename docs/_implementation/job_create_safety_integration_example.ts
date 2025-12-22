/**
 * Job Create 安全审查集成示例代码
 * 
 * 在 Job Service 的创建入口添加以下逻辑：
 */

import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

@Injectable()
export class JobServiceWithSafety {
    constructor(
        private readonly textSafetyService: TextSafetyService,
        private readonly featureFlagService: FeatureFlagService,
        // ... 其他依赖
    ) { }

    async createJob(
        payload: {
            enrichedText?: string;
            promptText?: string;
            rawText?: string;
            // ... 其他字段
        },
        context: {
            projectId: string;
            userId: string;
            orgId: string;
            ip?: string;
            userAgent?: string;
            traceId?: string;
        }
    ) {
        // 提取需要审查的文本（白名单字段）
        const textToCheck = payload.enrichedText || payload.promptText || payload.rawText;

        if (
            textToCheck &&
            this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE')
        ) {
            const jobId = generateUUID(); // 预生成ID用于记录

            const safetyResult = await this.textSafetyService.sanitize(textToCheck, {
                ...context,
                resourceType: 'JOB',
                resourceId: jobId,
            });

            // BLOCK 返回 422
            if (
                this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE') &&
                safetyResult.decision === 'BLOCK'
            ) {
                throw new UnprocessableEntityException({
                    statusCode: 422,
                    error: 'Unprocessable Entity',
                    message: 'Job creation blocked by safety check',
                    code: 'TEXT_SAFETY_VIOLATION',
                    details: {
                        decision: safetyResult.decision,
                        riskLevel: safetyResult.riskLevel,
                        reasons: safetyResult.reasons,
                        flags: safetyResult.flags,
                        traceId: safetyResult.traceId,
                    },
                });
            }

            // WARN: 继续创建，审计已记录
        }

        // 正常创建 Job 逻辑
        // ...
    }
}

function generateUUID() {
    return crypto.randomUUID();
}
