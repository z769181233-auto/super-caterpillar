import { Body, Controller, Post, Get, Param, BadRequestException } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsObject } from 'class-validator';
import { CostLedgerService, RecordCostEventParams } from './cost-ledger.service';
import { RequireSignature } from '../security/api-security/api-security.decorator';

class CostEventDto implements RecordCostEventParams {
  @IsString() userId!: string;
  @IsString() projectId!: string;
  @IsString() jobId!: string;
  @IsString() jobType!: string;
  @IsOptional() @IsString() engineKey?: string;
  @IsOptional() @IsNumber() attempt?: number; // ✅ P1-1: 试次感知
  @IsNumber() costAmount!: number;
  @IsString() currency!: string; // 允许传入,但service会SSOT纠正
  @IsString() billingUnit!: string; // job/tokens/seconds/frames
  @IsNumber() quantity!: number;
  @IsOptional() @IsObject() metadata?: any;
}

/**
 * Internal Events Controller
 * 用于Worker通过HTTP事件触发API侧业务逻辑
 * ✅ P0-2: 已添加 HMAC 鉴权保护
 */
@Controller('internal/events')
@RequireSignature() // P0-2: HMAC Guard 全局保护
export class InternalEventsController {
  constructor(private readonly costLedger: CostLedgerService) {}

  /**
   * HMAC 健康检查接口（仅 HMAC，不需要 JWT）
   * 用于压测和监控，验证 HMAC 签名机制正常工作
   *
   * 路径：GET /api/internal/events/hmac-ping
   * 鉴权：仅 HMAC (@RequireSignature)
   */
  @Get('hmac-ping')
  hmacPing(): { ok: boolean; ts: number; message: string } {
    return {
      ok: true,
      ts: Date.now(),
      message: 'HMAC authentication successful',
    };
  }

  /**
   * Worker报告Job成本事件
   * Worker不直接写DB,由此endpoint统一落库
   * ✅ P0-2: HMAC签名验证已强制执行
   * ✅ P1-1: 仅 SUCCEEDED job 允许计费（服务端硬校验）
   */
  @Post('cost-ledger')
  async recordCost(@Body() dto: CostEventDto) {
    try {
      const row = await this.costLedger.recordFromEvent(dto);
      return { ok: true, id: row.id, deduplicated: row.timestamp < new Date(Date.now() - 1000) };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // P1-1: 将计费拒绝错误映射为 400 而非 500
      if (msg.startsWith('BILLING_REJECTED_') || msg.startsWith('INVALID_')) {
        throw new BadRequestException({ code: 'BILLING_REJECTED', message: msg });
      }
      throw e;
    }
  }
}

/**
 * Cost API Controller
 * 提供项目成本查询接口
 */
@Controller('projects/:projectId/costs')
export class CostController {
  constructor(private readonly costLedgerService: CostLedgerService) {}

  /**
   * 获取项目的所有成本记录(分页TODO)
   */
  @Get()
  async getProjectCosts(@Param('projectId') projectId: string) {
    return this.costLedgerService.getProjectCosts(projectId);
  }

  /**
   * 获取项目成本汇总(不包含详细breakdown,避免大项目payload爆炸)
   */
  @Get('summary')
  async getCostSummary(@Param('projectId') projectId: string) {
    return this.costLedgerService.getProjectCostSummary(projectId);
  }

  /**
   * 按Job类型统计成本
   */
  @Get('by-type')
  async getCostByJobType(@Param('projectId') projectId: string) {
    return this.costLedgerService.getCostByJobType(projectId);
  }
}
