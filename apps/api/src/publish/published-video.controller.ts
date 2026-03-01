import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('publish')
export class PublishedVideoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('videos')
  @Public() // Allow public access for gate scripts if needed, or use GateModeGuard
  async getPublishedVideos(
    @Query('projectId') projectId?: string,
    @Query('assetId') assetId?: string,
    @Query('pipelineRunId') pipelineRunId?: string
  ) {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (assetId) where.assetId = assetId;
    if (pipelineRunId) {
      where.metadata = {
        path: ['pipelineRunId'],
        equals: pipelineRunId,
      };
    }

    const records = await this.prisma.publishedVideo.findMany({
      where,
      include: {
        asset: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: records,
      record: records[0] || null, // Convenience for gate scripts
      status: records[0]?.status || 'NOT_FOUND',
    };
  }
}
