import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NonceService } from '../nonce.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  shouldBypassSignature,
  shouldRequireSignature,
} from '../../common/utils/signature-path.utils';
import { buildHmacError } from '../../common/utils/hmac-error.utils';

/**
 * Timestamp + Nonce Guard
 * - 校验时间窗口（默认 ±300s，可通过 env/config 调整）
 * - 校验 / 写入 nonce_store，防重放
 */
@Injectable()
export class TimestampNonceGuard implements CanActivate {
  private readonly WINDOW_SECONDS = 300;

  constructor(
    private readonly nonceService: NonceService,
    private reflector: Reflector
  ) {}

  private getPath(req: any): string {
    const raw = (req.originalUrl || req.url || '') as string;
    return raw.split('?')[0];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // P1 Fix: OPTIONS request (CORS Preflight) should bypass Auth Guard
    if (request.method === 'OPTIONS') {
      return true;
    }

    const path = this.getPath(request);

    // 白名单免签：直接跳过
    if (shouldBypassSignature(path)) {
      return true;
    }

    // 其余路径要求签名校验
    if (!shouldRequireSignature(path)) {
      return true;
    }

    // 注意：@Public() 只跳过 JWT，不跳过 HMAC/Timestamp/Nonce 校验
    const hmac = request.hmac || {};
    const timestampStr = hmac.timestamp;
    const nonce = hmac.nonce;
    const apiKey = hmac.apiKey;

    if (!timestampStr || !nonce || !apiKey) {
      throw buildHmacError('4003', 'Invalid HMAC headers', {
        path: request.path || request.url,
        method: request.method,
      });
    }

    const ts = Number(timestampStr);
    if (Number.isNaN(ts)) {
      throw buildHmacError('4003', 'Invalid timestamp', {
        path: request.path || request.url,
        method: request.method,
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > this.WINDOW_SECONDS) {
      throw buildHmacError('4003', 'Timestamp out of window', {
        path: request.path || request.url,
        method: request.method,
      });
    }

    // Nonce 防重放：写入 nonce_store，若已存在则抛异常
    await this.nonceService.assertAndStoreNonce(nonce, apiKey, ts, {
      path: request.path || request.url,
      method: request.method,
      ip: request.ip || (request.headers['x-forwarded-for'] as string) || undefined,
      ua: (request.headers['user-agent'] as string) || undefined,
    });

    return true;
  }
}
