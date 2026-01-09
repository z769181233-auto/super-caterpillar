// apps/api/src/project/project-structure.controller.ts

import { Controller, Get, Param, UseGuards, Inject } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { ProjectStructureService } from './project-structure.service';
import { ProjectStructureTree } from '@scu/shared-types';
import { randomUUID } from 'crypto';

@Controller('projects/:projectId/structure')
@UseGuards(JwtOrHmacGuard)
export class ProjectStructureController {
  constructor(
    @Inject(ProjectStructureService)
    private readonly projectStructureService: ProjectStructureService
  ) {}

  /**
   * S3-C: GET /api/projects/:projectId/structure
   * 获取项目结构树，供 Studio 前端展示
   */
  @Get()
  async getProjectStructure(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null
  ): Promise<{
    success: boolean;
    data: ProjectStructureTree;
    requestId: string;
    timestamp: string;
  }> {
    if (!organizationId) {
      throw new Error('No organization context');
    }

    const data = await this.projectStructureService.getProjectStructureTree(
      projectId,
      user.userId,
      organizationId
    );

    return {
      success: true,
      data,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}
