import { Controller, Get, Param, Post, Body, Req } from '@nestjs/common';
import { PipelineService } from './pipeline.service';

@Controller('/api/projects/:projectId/pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get()
  async getPipeline(@Param('projectId') projectId: string) {
    return { success: true, data: await this.pipeline.getPipeline(projectId) };
  }

  @Post('/nodes/:nodeId/retry')
  async retryNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Req() req: any,
    @Body() body: any
  ) {
    const actorId = req?.user?.id || 'unknown';
    const reason = body?.reason;
    const r = await this.pipeline.retryNode(projectId, nodeId, actorId, reason);
    return { success: true, data: r };
  }

  @Post('/nodes/:nodeId/skip')
  async skipNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Req() req: any,
    @Body() body: any
  ) {
    const actorId = req?.user?.id || 'unknown';
    const reason = body?.reason;
    const r = await this.pipeline.skipNode(projectId, nodeId, actorId, reason);
    return { success: true, data: r };
  }

  @Post('/nodes/:nodeId/force-pass')
  async forcePassNode(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Req() req: any,
    @Body() body: any
  ) {
    const actorId = req?.user?.id || 'unknown';
    const reason = body?.reason;
    const r = await this.pipeline.forcePassNode(projectId, nodeId, actorId, reason);
    return { success: true, data: r };
  }
}
