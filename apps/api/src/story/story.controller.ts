import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { StoryService } from './story.service';
import { ParseStoryDto } from './dto/parse-story.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { Req } from '@nestjs/common';
import { Request } from 'express';

/**
 * Story Controller
 * 提供 CE06 (Novel Parsing) 标准 API
 * 
 * 规则：
 * - API 只负责参数校验 + 创建 Job
 * - 实际执行仍然走现有 JobService + Worker
 * - 不复制解析算法，不写业务逻辑
 */
@Controller('story')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  /**
   * POST /story/parse
   * CE06: Novel Parsing
   * 
   * 输入：raw_text
   * 输出：jobId, traceId, status
   */
  @Post('parse')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @HttpCode(HttpStatus.ACCEPTED)
  async parseStory(
    @Body() dto: ParseStoryDto,
    @CurrentUser() user: any,
    @CurrentOrganization() org: any,
    @Req() req: Request,
  ) {
    return this.storyService.parseStory(
      dto,
      user?.id,
      org?.id,
      req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
      req.headers['user-agent'] || undefined,
    );
  }
}

