import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EngineProfileService } from './engine-profile.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { randomUUID } from 'crypto';
import type { EngineProfileQuery, EngineProfileResponse } from '@scu/shared-types';

/**
 * S4-A: 引擎画像控制器
 * 
 * 提供只读的引擎画像统计 API
 */
@Controller('engine-profile')
@UseGuards(JwtOrHmacGuard)
export class EngineProfileController {
  constructor(private readonly engineProfileService: EngineProfileService) {}

  /**
   * GET /api/engine-profile/summary
   * 
   * 获取引擎画像统计摘要
   * 
   * 查询参数：
   * - engineKey?: string - 可选，若为空则统计所有引擎
   * - projectId?: string - 可选，用于单项目视角
   * - from?: string - ISO8601 时间范围起始（可选）
   * - to?: string - ISO8601 时间范围结束（可选）
   */
  @Get('summary')
  async getSummary(
    @Query('engineKey') engineKey?: string,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<{ success: boolean; data: EngineProfileResponse; requestId: string; timestamp: string }> {
    const query: EngineProfileQuery = {
      engineKey: engineKey || undefined,
      projectId: projectId || undefined,
      from: from || undefined,
      to: to || undefined,
    };

    const data = await this.engineProfileService.getProfileSummary(query);

    return {
      success: true,
      data,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}

