import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
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
    @Inject(JwtAuthGuard) private readonly jwtAuthGuard: JwtAuthGuard,
    @Inject(HmacAuthGuard) private readonly hmacAuthGuard: HmacAuthGuard,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) { }

  private hasJwt(req: any): boolean {
    const authHeader = req?.headers?.['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return true;
    }
    // Also check cookie (matching JwtStrategy)
    return !!req?.cookies?.['accessToken'];
  }

  private hasHmac(req: any): boolean {
    const h = req?.headers || {};
    return (
      typeof h['x-api-key'] === 'string' &&
      typeof h['x-signature'] === 'string' &&
      typeof h['x-timestamp'] === 'string' &&
      typeof h['x-nonce'] === 'string'
    );
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

    if (this.hasJwt(req)) {
      return (await this.jwtAuthGuard.canActivate(context)) as boolean;
    }

    if (this.hasHmac(req)) {
      return (await this.hmacAuthGuard.canActivate(context)) as boolean;
    }

    throw new UnauthorizedException('Missing auth header (JWT or HMAC required)');
  }
}











