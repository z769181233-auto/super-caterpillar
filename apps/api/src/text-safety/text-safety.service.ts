import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { createHash } from 'crypto';
import { TextSafetyMetrics } from '../observability/text_safety.metrics';

/**
 * TextSafetyService - Stage 11 三态决策实现
 *
 * 决策规则：
 * - BLOCK: 黑名单关键词 → critical
 * - WARN: 灰名单关键词（联系方式等）→ medium
 * - PASS: 无问题或仅占位符移除 → low
 */

export interface TextSafetyOutcome {
  decision: 'PASS' | 'WARN' | 'BLOCK';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sanitizedText: string;
  sanitizedDigest: string;
  flags: string[];
  reasons: string[];
  traceId?: string;
}

export interface TextSafetyContext {
  projectId: string;
  userId?: string;
  apiKeyId?: string;
  orgId?: string;
  ip?: string;
  userAgent?: string;
  traceId?: string;
  resourceType?: string; // 'NOVEL_SOURCE' | 'JOB' | 'SCENE_DRAFT'
  resourceId?: string;
}

@Injectable()
export class TextSafetyService {
  private readonly logger = new Logger(TextSafetyService.name);

  // 黑名单（BLOCK）
  private readonly BLACKLIST_KEYWORDS: string[] = [
    'violation',
    'prohibited',
    'illegal',
    'spam',
    'malware',
    'virus',
    'hacked',
  ];

  // 灰名单（WARN）
  private readonly GREYLIST_PATTERNS = [
    /微信[号id:：]?\s*[\w-]+/gi,
    /QQ[号id:：]?\s*\d{5,}/gi,
    /手机[号]?[：:]?\s*1[3-9]\d{9}/gi,
    /[\w-.]+@[\w-]+\.\w+/gi, // email
    /加我|私信|联系我|咨询我/gi,
  ];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(FeatureFlagService) private readonly featureFlagService: FeatureFlagService
  ) {}

  /**
   * 清洗并审查文本
   */
  async sanitize(inputText: string, context: TextSafetyContext): Promise<TextSafetyOutcome> {
    const start = Date.now();
    try {
      const triStateEnabled = this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE');

      if (!triStateEnabled) {
        // 旧行为：仅清洗，不拦截，不落库
        const sanitizedText = this.removePlaceholders(inputText);
        TextSafetyMetrics.recordDecision('PASS');
        TextSafetyMetrics.recordLatency(Date.now() - start);
        return {
          decision: 'PASS',
          riskLevel: 'low',
          sanitizedText,
          sanitizedDigest: this.sha256(sanitizedText),
          flags: sanitizedText !== inputText ? ['PLACEHOLDER_REMOVED'] : [],
          reasons: [],
          traceId: context.traceId,
        };
      }

      // 三态决策
      const flags: string[] = [];
      const reasons: string[] = [];
      let decision: 'PASS' | 'WARN' | 'BLOCK' = 'PASS';
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // 1. 黑名单检查
      const blacklistMatches = this.checkBlacklist(inputText);
      if (blacklistMatches.length > 0) {
        decision = 'BLOCK';
        riskLevel = 'critical';
        flags.push('BLACKLIST_MATCH');
        reasons.push(...blacklistMatches.map((kw) => `含违禁词: ${kw}`));
      }

      // 2. 灰名单检查（仅在未BLOCK时）
      if (decision !== 'BLOCK') {
        const greylistMatches = this.checkGreylist(inputText);
        if (greylistMatches.length > 0) {
          decision = 'WARN';
          riskLevel = 'medium';
          flags.push('GREYLIST_MATCH');
          reasons.push(...greylistMatches.map((m) => `含灰名单内容: ${m}`));
        }
      }

      // 3. 占位符移除
      const sanitizedText = this.removePlaceholders(inputText);
      if (sanitizedText !== inputText && decision === 'PASS') {
        flags.push('PLACEHOLDER_REMOVED');
        // 不升级为 WARN
      }

      const sanitizedDigest = this.sha256(sanitizedText);

      const outcome: TextSafetyOutcome = {
        decision,
        riskLevel,
        sanitizedText,
        sanitizedDigest,
        flags,
        reasons,
        traceId: context.traceId,
      };

      // 4. 落库 text_safety_results
      if (context.resourceType && context.resourceId) {
        try {
          await this.prisma.textSafetyResult.create({
            data: {
              resourceType: context.resourceType,
              resourceId: context.resourceId,
              decision,
              riskLevel,
              flags,
              reasons,
              sanitizedDigest,
              traceId: context.traceId,
            },
          });
        } catch (error) {
          this.logger.error('Failed to save TextSafetyResult', error);
          // 不阻断主流程
        }
      }

      // 5. 写审计日志
      const action =
        decision === 'PASS'
          ? 'TEXT_SAFETY_PASS'
          : decision === 'WARN'
            ? 'TEXT_SAFETY_WARN'
            : 'TEXT_SAFETY_BLOCK';

      await this.auditLogService.record({
        userId: context.userId,
        apiKeyId: context.apiKeyId,
        orgId: context.orgId,
        action,
        resourceType: context.resourceType || 'text',
        resourceId: context.resourceId || context.projectId,
        ip: context.ip,
        userAgent: context.userAgent,
        details: {
          decision,
          riskLevel,
          flags,
          reasons,
          digest: sanitizedDigest.substring(0, 16), // 前16位用于审计
          traceId: context.traceId,
        },
      });

      this.logger.log(
        `Text safety check: decision=${decision} riskLevel=${riskLevel} flags=${flags.join(',')}`
      );

      TextSafetyMetrics.recordDecision(decision);
      TextSafetyMetrics.recordLatency(Date.now() - start);

      return outcome;
    } catch (error) {
      // Fail-safe: 自动降级为 PASS
      this.logger.error(
        `TextSafetyService.sanitize FAILED, fallback to PASS. Error: ${error.message}`,
        error.stack
      );

      // 尝试记录审计
      try {
        await this.auditLogService.record({
          userId: context.userId,
          action: 'TEXT_SAFETY_FAILSAFE',
          resourceType: 'text',
          resourceId: context.resourceId || 'unknown',
          details: { error: error.message },
        });
      } catch (e) {
        /* ignore audit error during fail-safe */
      }

      // Metrics
      TextSafetyMetrics.recordDecision('PASS'); // Fail-safe counts as PASS for external flow
      TextSafetyMetrics.recordLatency(Date.now() - start);

      return {
        decision: 'PASS',
        riskLevel: 'low',
        sanitizedText: inputText, // Return original text on failure (or maybe partially sanitized if we wanted to risk it, but original is safer here to avoid data loss)
        sanitizedDigest: 'FAILSAFE',
        flags: ['FAILSAFE_TRIGGERED'],
        reasons: ['Internal error during sanitization'],
        traceId: context.traceId,
      };
    }
  }

  private checkBlacklist(text: string): string[] {
    const matches: string[] = [];
    const lowerText = text.toLowerCase();

    for (const keyword of this.BLACKLIST_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }

    return matches;
  }

  private checkGreylist(text: string): string[] {
    const matches: string[] = [];

    for (const pattern of this.GREYLIST_PATTERNS) {
      const found = text.match(pattern);
      if (found && found.length > 0) {
        matches.push(found[0].substring(0, 20)); // 截断避免泄露
      }
    }

    return matches;
  }

  private removePlaceholders(text: string): string {
    const placeholders = [/\[待填充\]/g, /\[TODO\]/g, /\[占位\]/g, /\[placeholder\]/gi];

    let sanitized = text;
    for (const pattern of placeholders) {
      sanitized = sanitized.replace(pattern, '');
    }

    return sanitized.trim();
  }

  private sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  // 导出常量供测试使用
  static readonly TEST_BLACKLIST_KEYWORD = 'violation';
  static readonly TEST_GREYLIST_PATTERN = '微信号test123';
}
