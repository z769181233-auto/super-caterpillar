/**
 * Novel Import 安全审查集成示例代码
 *
 * 在 Novel Import Service 或 Controller 的导入入口添加以下逻辑：
 */

import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

@Injectable()
export class NovelImportServiceWithSafety {
  constructor(
    private readonly textSafetyService: TextSafetyService,
    private readonly featureFlagService: FeatureFlagService
    // ... 其他依赖
  ) {}

  async importNovel(
    rawText: string,
    context: {
      projectId: string;
      userId: string;
      orgId: string;
      ip?: string;
      userAgent?: string;
      traceId?: string;
    }
  ) {
    // 安全审查（仅在 tri-state flag ON 时执行）
    if (this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE')) {
      const novelSourceId = generateUUID(); // 预生成ID用于记录

      const safetyResult = await this.textSafetyService.sanitize(rawText, {
        ...context,
        resourceType: 'NOVEL_SOURCE',
        resourceId: novelSourceId,
      });

      // BLOCK 返回 422
      if (
        this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT') &&
        safetyResult.decision === 'BLOCK'
      ) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: 'Content blocked by safety check',
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

      // WARN: 继续导入，但已有审计记录
      // (sanitize 内部已写入 text_safety_results + audit_logs)
    }

    // 正常导入逻辑
    // ...
  }
}

function generateUUID() {
  return crypto.randomUUID();
}
