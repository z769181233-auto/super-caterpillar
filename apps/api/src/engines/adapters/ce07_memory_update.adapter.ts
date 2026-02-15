import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

export type CE07MemoryType = 'relationship' | 'knowledge' | 'emotion' | 'skill';

export interface CE07MemoryInput {
  characterId: string;
  sceneId: string;
  memoryType: CE07MemoryType;
  content: string;
  ts?: string; // ISO
}

@Injectable()
export class CE07MemoryUpdateAdapter implements EngineAdapter {
  public readonly name = 'ce07_memory_update';
  private readonly logger = new Logger(CE07MemoryUpdateAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly costLedgerService: CostLedgerService
  ) {}

  supports(engineKey: string): boolean {
    return engineKey === 'ce07_memory_update';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    // Cast payload and context safely
    const payload = input.payload as unknown as CE07MemoryInput & { projectId?: string };
    const context = input.context || {};
    const traceId = context.traceId || `ce07_${randomUUID()}`;
    // Fallback: extract projectId from payload or context
    const projectId = context.projectId || payload.projectId;

    const t0 = performance.now();

    try {
      // 1. Validation
      if (!payload.characterId || !payload.sceneId || !payload.content || !payload.memoryType) {
        throw new Error('Missing required fields: characterId, sceneId, content, memoryType');
      }
      if (!projectId) {
        throw new Error('Missing projectId in context/payload');
      }

      // 2. Write to DB (REAL)
      const effectiveDate = payload.ts ? new Date(payload.ts) : new Date();

      const [cm, sm] = await this.prisma.$transaction([
        this.prisma.characterMemory.create({
          data: {
            characterId: payload.characterId,
            sceneId: payload.sceneId,
            memoryType: payload.memoryType,
            content: payload.content,
            createdAt: effectiveDate,
          },
        }),
        this.prisma.sceneMemory.create({
          data: {
            sceneId: payload.sceneId,
            memoryType: payload.memoryType,
            content: payload.content,
            createdAt: effectiveDate,
          },
        }),
      ]);

      // 3. Read back verification
      const verifyCm = await this.prisma.characterMemory.findUnique({
        where: { id: cm.id },
      });
      if (!verifyCm) throw new Error('Write-Readback verification failed for CharacterMemory');

      // 4. Audit Log (REAL)
      await this.auditService.log({
        action: 'CE07_MEMORY_UPDATE',
        resourceType: 'character_memory',
        resourceId: cm.id,
        traceId: traceId,
        details: {
          characterId: payload.characterId,
          sceneId: payload.sceneId,
          memoryType: payload.memoryType,
          contentHash: Buffer.from(payload.content).toString('base64').substring(0, 20) + '...',
          sceneMemoryId: sm.id,
          projectId: projectId,
        },
        userId: context.userId || 'system',
        organizationId: context.organizationId,
      });

      // 5. Cost Ledger (REAL)
      await this.costLedgerService.recordFromEvent({
        userId: context.userId || 'system',
        projectId: projectId,
        jobId: context.jobId || traceId,
        jobType: 'CE07_MEMORY_UPDATE',
        costAmount: 0,
        billingUnit: 'job',
        quantity: 1,
        engineKey: this.name,
        attempt: (context.attempt as number) || 1,
        metadata: { traceId, memoryId: cm.id },
      });

      const t1 = performance.now();
      const durationMs = Math.round(t1 - t0);

      this.logger.log(
        `[CE07] Finished memory update for character=${payload.characterId} duration=${durationMs}ms`
      );

      return {
        status: 'SUCCESS' as any,
        output: {
          status: 'PASS',
          recordIds: { characterMemoryId: cm.id, sceneMemoryId: sm.id },
          meta: {
            characterId: payload.characterId,
            sceneId: payload.sceneId,
            timestamp: effectiveDate.toISOString(),
            traceId,
          },
        },
        metrics: {
          durationMs,
        },
      };
    } catch (error: any) {
      this.logger.error(`[CE07] Failed: ${error.message}`, error.stack);
      return {
        status: 'FAILED' as any,
        error: {
          code: 'CE07_EXECUTION_ERROR',
          message: error.message,
        },
      };
    }
  }
}
