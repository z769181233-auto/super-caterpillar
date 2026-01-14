import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HmacAuthGuard } from '../hmac/hmac-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT 或 HMAC 任一通过即可
 * 规则：
 * - 如果请求头带 Bearer，则优先走 JWT Guard
 * - 否则若具备 HMAC 头，则走 HMAC Guard
 * - 两者都缺失则返回 401
 *
 * 不修改路由契约，仅聚合已有 Guard。
 */
@Injectable()
export class JwtOrHmacGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => JwtAuthGuard)) private readonly jwtAuthGuard: JwtAuthGuard,
    @Inject(forwardRef(() => HmacAuthGuard)) private readonly hmacAuthGuard: HmacAuthGuard,
    @Inject(Reflector) private readonly reflector: Reflector
  ) { }

  /**
   * P0-SEC: 大小写不敏感的 Header 读取
   * Express Request.get() 自动处理大小写，优先使用
   */
  private getHeader(req: any, name: string): string | undefined {
    const v1 = typeof req?.get === 'function' ? req.get(name) : undefined;
    if (typeof v1 === 'string' && v1.length > 0) return v1;

    const h = req?.headers || {};
    const key = name.toLowerCase();
    const v2 = h[key];
    return typeof v2 === 'string' && v2.length > 0 ? v2 : undefined;
  }

  private hasJwt(req: any): boolean {
    const authHeader = req?.headers?.['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return true;
    }
    // Also check cookie (matching JwtStrategy)
    return !!req?.cookies?.['accessToken'];
  }

  private hasHmac(req: any): boolean {
    // P0-SEC: 只要请求"看起来像" HMAC（存在任一 HMAC 头），就必须交给 HmacAuthGuard 抛 4003/4004
    // APISpec V1.1: HMAC 失败响应必须为 4003，不能降级为 401
    const apiKey = this.getHeader(req, 'X-Api-Key');
    const sig = this.getHeader(req, 'X-Signature');
    const nonce = this.getHeader(req, 'X-Nonce');
    const ts = this.getHeader(req, 'X-Timestamp');

    return !!(apiKey || sig || nonce || ts);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const dbg = process.env.HMAC_DEBUG === '1';
    const dlog = (obj: any) => {
      if (!dbg) return;
      try {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ tag: 'HMAC_DEBUG_STEP', ...obj }));
      } catch { }
    };

    if (this.hasJwt(req)) {
      dlog({ step: 'jwt_or_hmac_branch', branch: 'jwt' });
      return (await this.jwtAuthGuard.canActivate(context)) as boolean;
    }

    if (this.hasHmac(req)) {
      dlog({ step: 'jwt_or_hmac_branch', branch: 'hmac' });
      return (await this.hmacAuthGuard.canActivate(context)) as boolean;
    }

    dlog({ step: 'jwt_or_hmac_branch', branch: 'none' });
    throw new UnauthorizedException('Missing auth header (JWT or HMAC required)');
  }
}
