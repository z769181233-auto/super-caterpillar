import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { Stage4Service } from './stage4.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ProjectPermissions } from '../permission/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller('stage4')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class Stage4Controller {
  constructor(private readonly stage4Service: Stage4Service) {}

  // Scene 级语义增强
  @Post('projects/:projectId/scenes/:sceneId/semantic-enhancement')
  @Permissions(ProjectPermissions.PROJECT_GENERATE)
  async runSemanticEnhancement(
    @Param('projectId') projectId: string,
    @Param('sceneId') sceneId: string,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null
  ) {
    const data = await this.stage4Service.runSemanticEnhancement(projectId, sceneId, user.userId);
    await this.stage4Service.recordAudit(
      'SEMANTIC_ENHANCEMENT_RUN',
      'scene',
      sceneId,
      user.userId,
      { projectId, organizationId }
    );
    return { success: true, data };
  }

  @Get('projects/:projectId/scenes/:sceneId/semantic-enhancement')
  @Permissions(ProjectPermissions.PROJECT_READ)
  async getSemanticEnhancement(
    @Param('projectId') projectId: string,
    @Param('sceneId') sceneId: string
  ) {
    const record = await this.stage4Service.getSemanticEnhancement(sceneId);
    return { success: true, data: record?.data || null };
  }

  // Shot 级镜头规划
  @Post('projects/:projectId/shots/:shotId/shot-planning')
  @Permissions(ProjectPermissions.PROJECT_GENERATE)
  async runShotPlanning(
    @Param('projectId') projectId: string,
    @Param('shotId') shotId: string,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null
  ) {
    const data = await this.stage4Service.runShotPlanning(projectId, shotId, user.userId);
    await this.stage4Service.recordAudit('SHOT_PLANNING_RUN', 'shot', shotId, user.userId, {
      projectId,
      organizationId,
    });
    return { success: true, data };
  }

  @Get('projects/:projectId/shots/:shotId/shot-planning')
  @Permissions(ProjectPermissions.PROJECT_READ)
  async getShotPlanning(@Param('projectId') projectId: string, @Param('shotId') shotId: string) {
    const record = await this.stage4Service.getShotPlanning(shotId);
    return { success: true, data: record?.data || null };
  }

  // Project 级结构质量评估
  @Post('structure-quality/assess')
  @Permissions(ProjectPermissions.PROJECT_GENERATE)
  async runStructureQA(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null
  ) {
    const data = await this.stage4Service.runStructureQA(projectId, user.userId);
    await this.stage4Service.recordAudit('STRUCTURE_QA_RUN', 'project', projectId, user.userId, {
      organizationId,
    });
    return { success: true, data };
  }

  @Get('structure-quality/report')
  @Permissions(ProjectPermissions.PROJECT_READ)
  async getStructureQA(@Param('projectId') projectId: string) {
    const record = await this.stage4Service.getStructureQA(projectId);
    return { success: true, data: record?.data || null };
  }
}
