import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CostLedgerService } from '../cost/cost-ledger.service';

/**
 * 内部接口 Controller
 * 用于压测和监控，仅 HMAC 认证，不需要 JWT
 */
@Controller('internal')
export class InternalController {
  constructor(private readonly costLedgerService: CostLedgerService) { }

  /**
   * HMAC 健康检查接口（仅 HMAC，不需要 JWT）
   * 用于压测和监控，验证 HMAC 签名机制正常工作
   *
   * 路径：GET /api/internal/hmac-ping
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

  /**
   * P0 Hotfix: Cost Ledger Event Endpoint
   * 接收Worker发送的计费事件并记录到CostLedger
   * 
   * 路径：POST /api/internal/events/cost-ledger
   * 认证：仅 HMAC (Worker HMAC v1.1)
   */
  @Public()
  @Post('events/cost-ledger')
  async recordCostEvent(@Body() payload: any): Promise<{ success: boolean; ok: boolean; id: string; deduplicated: boolean }> {
    try {
      const result = await this.costLedgerService.recordFromEvent(payload);
      return {
        success: true,
        ok: true,
        id: result.id,
        deduplicated: false, // TODO: detect from result if needed
      };
    } catch (error: any) {
      // P2002 幂等冲突不算错误
      if (error?.code === 'P2002') {
        return {
          success: true,
          ok: true,
          id: 'deduplicated',
          deduplicated: true,
        };
      }
      throw error;
    }
  }
}
