import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { TextService } from './text.service';
import { VisualDensityDto } from './dto/visual-density.dto';
import { VisualEnrichDto } from './dto/visual-enrich.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { Req } from '@nestjs/common';
import { Request } from 'express';

/**
 * Text Controller
 * 提供 CE03 (Visual Density) 和 CE04 (Visual Enrichment) 标准 API
 * 
 * 规则：
 * - API 只负责参数校验 + 创建 Job
 * - 实际执行仍然走现有 JobService + Worker
 * - CE04 前置 Safety Hook（TextSafetyService.sanitize）
 */
@Controller('text')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class TextController {
  constructor(private readonly textService: TextService) {}

  /**
   * POST /text/visual-density
   * CE03: Visual Density
   * 
   * 输入：text, projectId
   * 输出：jobId, traceId, status
   */
  @Post('visual-density')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @HttpCode(HttpStatus.ACCEPTED)
  async visualDensity(
    @Body() dto: VisualDensityDto,
    @CurrentUser() user: any,
    @CurrentOrganization() org: any,
    @Req() req: Request,
  ) {
    return this.textService.visualDensity(
      dto,
      user?.id,
      org?.id,
      req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
      req.headers['user-agent'] || undefined,
    );
  }

  /**
   * POST /text/enrich
   * CE04: Visual Enrichment
   * 
   * 输入：text, projectId, previousJobId (可选)
   * 输出：jobId, traceId, status
   * 
   * 前置：TextSafetyService.sanitize
   */
  @Post('enrich')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @HttpCode(HttpStatus.ACCEPTED)
  async visualEnrich(
    @Body() dto: VisualEnrichDto,
    @CurrentUser() user: any,
    @CurrentOrganization() org: any,
    @Req() req: Request,
  ) {
    return this.textService.visualEnrich(
      dto,
      user?.id,
      org?.id,
      req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
      req.headers['user-agent'] || undefined,
    );
  }
}

