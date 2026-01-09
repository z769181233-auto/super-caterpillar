import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { CEEngineService } from './ce-engine.service';
import { ParseStoryDto } from './dto/parse-story.dto';
import { VisualDensityDto } from './dto/visual-density.dto';
import { EnrichTextDto } from './dto/enrich-text.dto';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';
import { Request } from 'express';
import { Req } from '@nestjs/common';

/**
 * CEEngineController
 * CE 核心引擎标准 API 端点
 *
 * 规则：
 * - 只负责参数校验 + 调用 Service
 * - 实际执行仍然走现有 JobService / Worker
 * - 不复制业务逻辑
 */
@Controller()
@UseGuards(JwtOrHmacGuard)
export class CEEngineController {
  private readonly logger = new Logger(CEEngineController.name);

  constructor(private readonly ceEngineService: CEEngineService) {}

  /**
   * POST /story/parse
   * CE06: 解析小说
   */
  @Post('story/parse')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  async parseStory(
    @Body() dto: ParseStoryDto,
    @CurrentUser() userId: string,
    @CurrentOrganization() organizationId: string,
    @Req() req: Request
  ) {
    this.logger.log(
      `CE06 parseStory request: projectId=${dto.projectId}, textLength=${dto.rawText.length}`
    );

    const result = await this.ceEngineService.parseStory(
      {
        projectId: dto.projectId,
        rawText: dto.rawText,
        options: dto.options,
      },
      userId,
      organizationId
    );

    return result;
  }

  /**
   * POST /text/visual-density
   * CE03: 视觉密度分析
   */
  @Post('text/visual-density')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  async analyzeVisualDensity(
    @Body() dto: VisualDensityDto,
    @CurrentUser() userId: string,
    @CurrentOrganization() organizationId: string,
    @Req() req: Request
  ) {
    this.logger.log(
      `CE03 analyzeVisualDensity request: projectId=${dto.projectId}, textLength=${dto.text.length}`
    );

    const result = await this.ceEngineService.analyzeVisualDensity(
      {
        projectId: dto.projectId,
        text: dto.text,
        options: dto.options,
      },
      userId,
      organizationId
    );

    return result;
  }

  /**
   * POST /text/enrich
   * CE04: 文本增强（带前置 Safety Hook）
   */
  @Post('text/enrich')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  async enrichText(
    @Body() dto: EnrichTextDto,
    @CurrentUser() userId: string,
    @CurrentOrganization() organizationId: string,
    @Req() req: Request
  ) {
    this.logger.log(
      `CE04 enrichText request: projectId=${dto.projectId}, textLength=${dto.text.length}`
    );

    // 提取 API Key ID（如果有）
    const apiKeyId = (req as any).apiKeyId;

    const result = await this.ceEngineService.enrichText(
      {
        projectId: dto.projectId,
        text: dto.text,
        options: dto.options,
      },
      userId,
      organizationId,
      apiKeyId,
      req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
      req.headers['user-agent'] || undefined
    );

    return result;
  }
}
