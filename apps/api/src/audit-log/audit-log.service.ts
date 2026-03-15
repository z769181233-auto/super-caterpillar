import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac, randomBytes, createHash } from 'crypto';
const { Client } = require('pg');

/**
 * 审计日志服务
 * 负责记录关键操作的审计日志
 *
 * 设计原则：
 * - 写入失败不得影响主业务流程
 * - 异步写入，不阻塞请求
 * - 记录关键信息，便于后续审计和风控
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private shouldFallbackToPg(error: any): boolean {
    const message = String(error?.message || '');
    return (
      message.includes('PRISMA_QUERY_TIMEOUT') ||
      message.includes('startup connect exceeded') ||
      message.includes("Can't reach database server") ||
      message.includes('P1001')
    );
  }

  private async withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: this.prismaQueryTimeoutMs,
      query_timeout: this.prismaQueryTimeoutMs,
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /**
   * 记录审计日志
   * S1-FIX-A: 新增 payload 字段，包含所有审计信息的完整快照
   * @param options 审计日志选项
   */
  async record(options: {
    userId?: string;
    orgId?: string;
    apiKeyId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
    details?: any;
    traceId?: string;
    // nonce, signature, timestamp can be passed from request (V1.1 columns)
    nonce?: string;
    signature?: string;
    timestamp?: Date;
    req?: any; // Phase-C: Supporting request object for auto-header extraction
  }): Promise<void> {
    try {
      const { req } = options;

      // PHASE-C: Capture Request-level Evidence (Spec V1.1)
      const reqNonce =
        options.nonce || req?.headers['x-nonce'] || req?.headers['x-hmac-nonce'] || req?.hmacNonce;
      const reqSignature =
        options.signature ||
        req?.headers['x-signature'] ||
        req?.headers['x-hmac-signature'] ||
        req?.hmacSignature;
      const reqTimestampStr =
        req?.headers['x-timestamp'] || req?.headers['x-hmac-timestamp'] || req?.hmacTimestamp;
      const reqTimestamp =
        options.timestamp || (reqTimestampStr ? new Date(reqTimestampStr) : undefined);

      const ip = options.ip || req?.ip || req?.headers['x-forwarded-for'];
      const userAgent = options.userAgent || req?.headers['user-agent'];
      const traceId = options.traceId || `trace-${randomBytes(8).toString('hex')}`;

      // Server-level Integrity Evidence (Prevent log tampering)
      const serverTimestamp = new Date();
      const serverNonce = randomBytes(16).toString('hex');

      const details = options.details ? { ...options.details } : {};
      details._traceId = traceId;

      let detailsStr = '';
      try {
        // [P6-0 Fix] Avoid stringifying huge objects repeatedly
        detailsStr = JSON.stringify(details);
      } catch (e) {
        detailsStr = '[UNSERIALIZABLE]';
      }
      const detailsDigest = createHash('sha256').update(detailsStr).digest('hex');

      const signBase = [
        options.action,
        options.resourceType,
        options.resourceId || '',
        serverTimestamp.toISOString(),
        serverNonce,
        detailsDigest,
        traceId,
      ].join('|');

      const secret = process.env.AUDIT_SIGNING_SECRET;
      const recordSignature = createHmac(
        'sha256',
        secret || 'EMERGENCY_UNSECURE_FALLBACK_SUPER_CATERPILLAR'
      )
        .update(signBase)
        .digest('hex');

      const payload = {
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId ?? null,
        orgId: options.orgId ?? null,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        nonce: reqNonce || serverNonce,
        signature: reqSignature || recordSignature,
        timestamp: (reqTimestamp || serverTimestamp).toISOString(),
        details,
        traceId,
        auditKeyVersion: 'v1',
      };
      const recordId = `audit_${randomBytes(12).toString('hex')}`;

      const createData = {
        id: recordId,
        userId: options.userId,
        orgId: options.orgId,
        apiKeyId: options.apiKeyId,
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        ip: ip as any,
        userAgent: userAgent as any,
        details: details as any,
        nonce: reqNonce || serverNonce,
        signature: reqSignature || recordSignature,
        timestamp: reqTimestamp || serverTimestamp,
        payload: payload as any,
      };

      try {
        await this.prisma.auditLog.create({ data: createData });
      } catch (error: any) {
        if (!this.shouldFallbackToPg(error)) {
          throw error;
        }

        this.logger.warn(
          `Prisma audit log degraded for ${options.action} ${options.resourceType}:${options.resourceId}, using pg fallback: ${error.message}`
        );

        await this.withPgClient((client) =>
          client.query(
            `
              INSERT INTO audit_logs
                (id, "userId", "orgId", "apiKeyId", action, "resourceType", "resourceId", ip, "userAgent", details, nonce, signature, timestamp, payload, "createdAt")
              VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb,NOW())
            `,
            [
              createData.id,
              createData.userId ?? null,
              createData.orgId ?? null,
              createData.apiKeyId ?? null,
              createData.action,
              createData.resourceType,
              createData.resourceId ?? null,
              createData.ip ?? null,
              createData.userAgent ?? null,
              JSON.stringify(details),
              createData.nonce,
              createData.signature,
              createData.timestamp,
              JSON.stringify(payload),
            ]
          )
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to record audit log: ${options.action} for ${options.resourceType}:${options.resourceId}`,
        error?.stack
      );
    }
  }

  /**
   * 从请求对象中提取 IP 和 UserAgent
   * @param request Express Request 对象
   * @returns { ip: string | undefined, userAgent: string | undefined }
   */
  static extractRequestInfo(request: any): { ip?: string; userAgent?: string } {
    return {
      ip: request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
    };
  }
}
