import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { MemoryService } from './memory.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Memory Controller
 * 提供 CE07 (Short-Term Memory) 和 CE08 (Long-Term Memory / Story KG) 标准 API
 * 
 * 功能：
 * - GET /memory/short-term/:chapterId: 获取章节短期记忆
 * - GET /memory/long-term/:entityId: 获取实体长期记忆
 * - POST /memory/update: 更新记忆
 */
@Controller('memory')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  /**
   * GET /memory/short-term/:chapterId
   * CE07: 获取章节短期记忆
   */
  @Get('short-term/:chapterId')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @AuditAction(AuditActions.MEMORY_ACCESS)
  @HttpCode(HttpStatus.OK)
  async getShortTermMemory(
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.getShortTermMemory(chapterId, user?.id);
  }

  /**
   * GET /memory/long-term/:entityId
   * CE08: 获取实体长期记忆
   */
  @Get('long-term/:entityId')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @AuditAction(AuditActions.MEMORY_ACCESS)
  @HttpCode(HttpStatus.OK)
  async getLongTermMemory(
    @Param('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.getLongTermMemory(entityId, user?.id);
  }

  /**
   * POST /memory/update
   * CE07/CE08: 更新记忆
   */
  @Post('update')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @AuditAction(AuditActions.MEMORY_UPDATE)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateMemory(
    @Body() body: { type: 'short-term' | 'long-term'; chapterId?: string; entityId?: string; data: any },
    @CurrentUser() user: any,
  ) {
    return this.memoryService.updateMemory(body, user?.id);
  }
}

