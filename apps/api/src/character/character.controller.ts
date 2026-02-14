import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CharacterService } from './character.service';
import {
    CreateCharacterDto,
    UpdateCharacterDto,
    RecordAppearanceDto,
    TrainLoraDto,
} from './character.dto';

@Controller('v1')
export class CharacterController {
    constructor(private readonly characterService: CharacterService) { }

    /**
     * 创建角色档案
     * POST /api/v1/projects/:projectId/characters
     */
    @Post('projects/:projectId/characters')
    async create(
        @Param('projectId') projectId: string,
        @Body() dto: CreateCharacterDto
    ) {
        return this.characterService.create(projectId, dto);
    }

    /**
     * 获取项目所有角色
     * GET /api/v1/projects/:projectId/characters
     */
    @Get('projects/:projectId/characters')
    async findAll(@Param('projectId') projectId: string) {
        return this.characterService.findAll(projectId);
    }

    /**
     * 获取单个角色
     * GET /api/v1/characters/:characterId
     */
    @Get('characters/:characterId')
    async findOne(@Param('characterId') characterId: string) {
        return this.characterService.findOne(characterId);
    }

    /**
     * 更新角色
     * PATCH /api/v1/characters/:characterId
     */
    @Patch('characters/:characterId')
    async update(
        @Param('characterId') characterId: string,
        @Body() dto: UpdateCharacterDto
    ) {
        return this.characterService.update(characterId, dto);
    }

    /**
     * 删除角色
     * DELETE /api/v1/characters/:characterId
     */
    @Delete('characters/:characterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('characterId') characterId: string) {
        await this.characterService.remove(characterId);
    }

    /**
     * 获取角色所有出现记录
     * GET /api/v1/characters/:characterId/appearances
     */
    @Get('characters/:characterId/appearances')
    async getAppearances(
        @Param('characterId') characterId: string,
        @Query('limit') limit?: number
    ) {
        return this.characterService.getAppearances(
            characterId,
            limit ? parseInt(limit.toString(), 10) : 50
        );
    }

    /**
     * 记录角色出现
     * POST /api/v1/characters/:characterId/appearances
     */
    @Post('characters/:characterId/appearances')
    async recordAppearance(
        @Param('characterId') characterId: string,
        @Body() dto: RecordAppearanceDto
    ) {
        return this.characterService.recordAppearance(characterId, dto);
    }

    /**
     * 收集训练集图片
     * GET /api/v1/characters/:characterId/training-images
     */
    @Get('characters/:characterId/training-images')
    async getTrainingImages(
        @Param('characterId') characterId: string,
        @Query('minScore') minScore?: number
    ) {
        return this.characterService.collectTrainingImages(
            characterId,
            minScore ? parseFloat(minScore.toString()) : 0.7
        );
    }

    /**
     * 触发 LoRA 训练（预留接口）
     * POST /api/v1/characters/:characterId/train
     */
    @Post('characters/:characterId/train')
    async trainLora(
        @Param('characterId') characterId: string,
        @Body() dto: TrainLoraDto
    ) {
        // TODO: B2.2 实现 LoRA 训练逻辑
        return {
            message: 'LoRA training will be implemented in B2.2',
            characterId,
            dto,
        };
    }
}
