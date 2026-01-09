import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActions } from '../audit/audit.constants';

/**
 * Text Safety Service
 * CE04 前置安全检测（最小实现）
 *
 * 规则：
 * - 关键词黑名单
 * - 占位清洗
 * - 记录 safetyFlags
 * - 清洗前/清洗后都记录在 AuditLog.details
 */
@Injectable()
export class TextSafetyService {
  private readonly logger = new Logger(TextSafetyService.name);

  // 关键词黑名单（最小实现，后续可扩展为配置或数据库）
  private readonly BLACKLIST_KEYWORDS: string[] = [
    // 敏感词示例（实际应使用更完整的列表）
    '暴力',
    '色情',
    '政治敏感',
    // ... 更多关键词
  ];

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * 文本安全清洗
   *
   * @param text 原始文本
   * @param userId 用户 ID（用于审计）
   * @param ip IP 地址（用于审计）
   * @param userAgent UserAgent（用于审计）
   * @returns 清洗结果
   */
  async sanitize(
    text: string,
    userId?: string,
    ip?: string,
    userAgent?: string
  ): Promise<{
    passed: boolean;
    sanitizedText: string;
    flags: string[];
  }> {
    const flags: string[] = [];
    let sanitizedText = text;

    // 1. 关键词黑名单检测
    const lowerText = text.toLowerCase();
    for (const keyword of this.BLACKLIST_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        flags.push(`BLACKLIST_KEYWORD:${keyword}`);
        // 占位清洗：替换为 [已过滤]
        sanitizedText = sanitizedText.replace(new RegExp(keyword, 'gi'), '[已过滤]');
      }
    }

    // 2. 其他安全检测（最小实现，后续可扩展）
    // 例如：URL 检测、脚本检测等

    // 3. 判断是否通过
    const passed = flags.length === 0;

    // 4. 记录审计日志（清洗前后文本）
    await this.auditLogService.record({
      userId,
      action: AuditActions.SAFETY_CHECK,
      resourceType: 'text',
      resourceId: undefined,
      ip,
      userAgent,
      details: {
        passed,
        flags,
        originalText: text,
        sanitizedText,
        timestamp: new Date().toISOString(),
      },
    });

    if (!passed) {
      this.logger.warn(`Text safety check failed: flags=${flags.join(', ')}`);
    }

    return {
      passed,
      sanitizedText,
      flags,
    };
  }
}
