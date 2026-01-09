import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

/**
 * 内部接口 Controller
 * 用于压测和监控，仅 HMAC 认证，不需要 JWT
 */
@Controller('_internal')
export class InternalController {
  /**
   * HMAC 健康检查接口（仅 HMAC，不需要 JWT）
   * 用于压测和监控，验证 HMAC 签名机制正常工作
   *
   * 路径：GET /api/_internal/hmac-ping
   * 认证：仅 HMAC（HmacGuard + TimestampNonceGuard），不要求 JWT
   *
   * 使用 @Public() 装饰器跳过 JWT 验证（如果存在全局 JwtAuthGuard）
   */
  @Public()
  @Get('hmac-ping')
  hmacPing(): { ok: boolean; ts: number; message: string } {
    return {
      ok: true,
      ts: Date.now(),
      message: 'HMAC authentication successful',
    };
  }
}
