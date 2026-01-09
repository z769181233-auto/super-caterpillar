import { Controller, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { ShotDirectorService } from './shot-director.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Shot Director Controller
 * 提供 CE05 (Director Control) 标准 API
 *
 * 功能：
 * - POST /shots/:shotId/inpaint: 图像修复
 * - POST /shots/:shotId/pose: 姿态控制
 */
@Controller('shots')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class ShotDirectorController {
  constructor(private readonly shotDirectorService: ShotDirectorService) {}

  /**
   * POST /shots/:shotId/inpaint
   * CE05: 图像修复
   */
  @Post(':shotId/inpaint')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @AuditAction(AuditActions.SHOT_INPAINT)
  @HttpCode(HttpStatus.ACCEPTED)
  async inpaint(@Param('shotId') shotId: string, @CurrentUser() user: any) {
    return this.shotDirectorService.inpaint(shotId, user?.id);
  }

  /**
   * POST /shots/:shotId/pose
   * CE05: 姿态控制
   */
  @Post(':shotId/pose')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @AuditAction(AuditActions.SHOT_POSE)
  @HttpCode(HttpStatus.ACCEPTED)
  async pose(@Param('shotId') shotId: string, @CurrentUser() user: any) {
    return this.shotDirectorService.pose(shotId, user?.id);
  }

  /**
   * POST /shots/scene/:sceneId/compose-video
   * Stage 8: 触发视频合成
   */
  @Post('scene/:sceneId/compose-video')
  @RequireSignature()
  @HttpCode(HttpStatus.OK)
  async composeVideo(@Param('sceneId') sceneId: string, @CurrentUser() user: any) {
    return this.shotDirectorService.composeVideo(sceneId, user?.id);
  }
}
