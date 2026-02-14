import { Body, Controller, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { StoryService } from '../story/story.service';
import { TextService } from '../text/text.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { Request } from 'express';

/**
 * Bible Alias Controller (P23-0)
 * 为对齐外部 API Bible 规范而提供的路由映射。
 * 规则：
 * - 仅作为别名入口，内部逻辑完全委托给现有 Service。
 * - 同时提供 /_internal 路径以便 Gate 验证一致性。
 */

type StoryParseDto = {
  text?: string;
  rawText?: string;
  raw_text?: string;
  projectId: string;
  project_id?: string;
  title?: string;
  author?: string;
};

type TextEnrichDto = {
  text: string;
  projectId: string;
};

function requireInternalEnabled() {
  if (process.env.BIBLE_INTERNAL_ALIAS_ENABLED !== '1') {
    throw new NotFoundException('internal route disabled');
  }
}

@Controller()
@UseGuards(JwtOrHmacGuard)
export class BibleAliasController {
  constructor(
    private readonly storyService: StoryService,
    private readonly textService: TextService
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Story Parse (Alias for CE06 Pipeline)
  // ---------------------------------------------------------------------------

  @Post('/_internal/story/parse')
  @RequireSignature()
  async internalStoryParse(@Body() body: any, @Req() req: any) {
    requireInternalEnabled();
    return this.handleStoryParse(body, req);
  }

  @Post('/story/parse')
  @RequireSignature()
  async storyParse(@Body() body: any, @Req() req: any) {
    return this.handleStoryParse(body, req);
  }

  private async handleStoryParse(body: any, req: any) {
    // eslint-disable-next-line no-console
    console.log('[BibleAlias DEBUG] handleStoryParse incoming body keys:', Object.keys(body));
    // 映射所有可能的字段
    const rawText = body.text || body.rawText || body.raw_text;
    const projectId = body.projectId || body.project_id;
    const title = body.title || body.name;
    const author = body.author;

    const organizationId = req.user?.organizationId || req.apiKeyOwnerOrgId;
    const userId = req.user?.id || req.apiKeyOwnerUserId;
    const traceId = req.headers['x-request-id'] || req.headers['x-trace-id'];

    const result = await this.storyService.parseStory(
      {
        rawText: rawText as string,
        projectId: projectId as string,
        title: title as string,
        author: author as string,
      },
      userId,
      organizationId,
      req.ip,
      req.headers['user-agent'],
      traceId
    );

    return {
      success: true,
      data: {
        jobId: result.jobId,
        status: result.status,
        taskId: result.taskId,
        traceId: result.traceId,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Text Enrich (Alias for CE04 Enrichment)
  // ---------------------------------------------------------------------------

  @Post('/_internal/text/enrich')
  @RequireSignature()
  async internalTextEnrich(@Body() body: TextEnrichDto, @Req() req: any) {
    requireInternalEnabled();
    return this.handleTextEnrich(body, req);
  }

  @Post('/text/enrich')
  @RequireSignature()
  async textEnrich(@Body() body: TextEnrichDto, @Req() req: any) {
    return this.handleTextEnrich(body, req);
  }

  private async handleTextEnrich(body: TextEnrichDto, req: Request) {
    const user = (req as any).user;
    const organizationId = (req as any).user?.organizationId || (req as any).apiKeyOwnerOrgId;

    // 直接调用 TextService
    const result = await this.textService.visualEnrich(
      {
        text: body.text,
        projectId: body.projectId,
      },
      user?.id,
      organizationId,
      req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
      req.headers['user-agent'] || undefined
    );

    return result;
  }
}
