import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ScriptBuildService } from './script-build.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('builds')
export class ScriptBuildController {
    constructor(private readonly scriptBuildService: ScriptBuildService) { }

    @Get(':id/outline')
    @Public()
    @UseGuards(JwtOrHmacGuard)
    async getOutline(@Param('id') id: string) {
        console.log(`[ScriptBuildController] getOutline called for id: ${id}`);
        try {
            return await this.scriptBuildService.getOutline(id);
        } catch (e) {
            console.error(`[ScriptBuildController] getOutline error:`, e);
            throw e;
        }
    }
}

@Controller('shots')
export class ShotsController {
    constructor(private readonly scriptBuildService: ScriptBuildService) { }

    @Get(':id/source')
    @Public()
    @UseGuards(JwtOrHmacGuard)
    async getSource(@Param('id') id: string, @Query('context') context?: string) {
        console.log(`[ShotsController] getSource called for id: ${id}`);
        const contextSize = context ? parseInt(context, 10) : 400;
        try {
            return await this.scriptBuildService.getShotSource(id, contextSize);
        } catch (e) {
            console.error(`[ShotsController] getSource error:`, e);
            throw e;
        }
    }
}
