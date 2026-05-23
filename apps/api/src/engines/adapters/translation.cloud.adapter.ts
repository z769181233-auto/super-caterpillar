import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { createHash } from 'crypto';

@Injectable()
export class TranslationCloudAdapter implements EngineAdapter {
  public readonly name = 'translation_engine';
  private readonly logger = new Logger(TranslationCloudAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly costLedgerService: CostLedgerService
  ) {}

  supports(engineKey: string): boolean {
    return engineKey === 'translation_engine';
  }

  private requireTraceId(value: unknown): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    throw new Error('[TranslationCloudAdapter] Missing context.traceId');
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    try {
      const traceId = this.requireTraceId(input.context?.traceId);
      const payload = input.payload || {};
      const sourceText = payload.sourceText || '';
      const targetLang = payload.targetLang || 'en';
      const provider = payload.provider || process.env.TRANSLATION_PROVIDER || 'deepl';
      const sourceLang = payload.sourceLang || 'auto';

      if (!sourceText) {
        throw new Error('sourceText is required');
      }

      // 1. Calculate Hash
      const inputHash = createHash('sha256').update(sourceText).digest('hex');

      // 2. Check Cache
      // (provider, targetLang, inputHash, projectId) is unique
      const cached = await this.prisma.translationCache.findUnique({
        where: {
          provider_target_hash_project: {
            provider,
            targetLang,
            inputHash,
            projectId: input.context.projectId || '',
          },
        },
      });

      if (cached) {
        await this.auditHelper(input, traceId, 'HIT', `hash:${inputHash}`);
        await this.recordCost(input, traceId, 0); // 0 cost for cache hit
        return {
          status: 'SUCCESS' as any,
          output: {
            text: cached.outputText,
            source: 'cache',
            meta: { provider, lang: targetLang },
          },
        };
      }

      // 3. Check Key (No Key Fail Requirement)
      const apiKeyEnv = 'TRANSLATION_API_KEY';
      const apiKey = process.env[apiKeyEnv];
      if (!apiKey) {
        throw new Error(`TRANSLATION_NO_KEY: Missing environment variable ${apiKeyEnv}`);
      }

      // 4. Invoke Provider
      // 当前仓库尚未接入真实 Translation Provider，禁止使用伪翻译结果继续落库和计费。
      throw new Error(
        `TRANSLATION_PROVIDER_NOT_IMPLEMENTED: provider=${provider} sourceLang=${sourceLang} targetLang=${targetLang}`
      );
    } catch (error: any) {
      this.logger.error(`[Translation] Failed: ${error.message}`);
      // Integrity: Record Failure
      const traceId =
        typeof input.context?.traceId === 'string' && input.context.traceId.trim().length > 0
          ? input.context.traceId
          : null;
      if (traceId) {
        await this.auditHelper(input, traceId, 'MISS', 'failed_request', {
        status: 'FAILED',
        error: error.message,
        });
        await this.recordCost(input, traceId, 0, { status: 'FAILED' });
      }

      return {
        status: 'FAILED' as any,
        error: {
          code: error.message.includes('NO_KEY') ? 'TRANSLATION_NO_KEY' : 'TRANSLATION_ERROR',
          message: error.message,
        },
      };
    }
  }

  private async auditHelper(
    input: EngineInvokeInput,
    traceId: string,
    type: 'HIT' | 'MISS',
    resourceId: string,
    extraDetails: any = {}
  ) {
    try {
      await this.auditService.log({
        action: 'TRANSLATION_INVOKE',
        resourceId: resourceId,
        resourceType: 'translation',
        details: {
          projectId: input.context.projectId,
          userId: input.context.userId || 'system',
          cache: type,
          engine: this.name,
          traceId,
          ...extraDetails,
        },
      });
    } catch (e) {
      this.logger.warn(`Audit failed: ${e}`);
    }
  }

  private async recordCost(
    input: EngineInvokeInput,
    traceId: string,
    amount: number,
    extraDetails: any = {}
  ) {
    try {
      await this.costLedgerService.recordFromEvent({
        userId: input.context.userId || 'system',
        projectId: input.context.projectId || '',
        jobId: input.context.jobId,
        jobType: input.jobType || 'TRANSLATION',
        engineKey: this.name,
        costAmount: amount,
        billingUnit: 'job',
        quantity: 1,
        attempt: (input.context as any).attempt || 1,
        metadata: {
          type: 'translation',
          traceId,
          ...extraDetails,
        },
      });
    } catch (e) {
      this.logger.warn(`Cost record failed: ${e}`);
    }
  }
}
