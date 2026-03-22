import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { ScriptBuildService } from './script-build.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Public } from '../auth/decorators/public.decorator';

@UseGuards(JwtOrHmacGuard)
@Controller('builds')
export class ScriptBuildController {
  private readonly logger = new Logger(ScriptBuildController.name);

  constructor(private readonly scriptBuildService: ScriptBuildService) {}

  @Get(':id/outline')
  @Public()
  @UseGuards(JwtOrHmacGuard)
  async getOutline(@Param('id') id: string) {
    this.logger.log(`[ScriptBuildController] getOutline id=${id}`);
    try {
      return await this.scriptBuildService.getOutline(id);
    } catch (e) {
      this.logger.error(
        `[ScriptBuildController] getOutline error: ${e instanceof Error ? e.message : String(e)}`
      );
      throw e;
    }
  }
}

@Controller('shots')
export class ShotsController {
  private readonly logger = new Logger(ShotsController.name);

  constructor(private readonly scriptBuildService: ScriptBuildService) {}

  @Get(':id/source')
  @Public()
  @UseGuards(JwtOrHmacGuard)
  async getSource(@Param('id') id: string, @Query('context') context?: string) {
    this.logger.log(`[ShotsController] getSource id=${id}`);
    const contextSize = context ? parseInt(context, 10) : 400;
    try {
      return await this.scriptBuildService.getShotSource(id, contextSize);
    } catch (e) {
      this.logger.error(
        `[ShotsController] getSource error: ${e instanceof Error ? e.message : String(e)}`
      );
      throw e;
    }
  }
}
