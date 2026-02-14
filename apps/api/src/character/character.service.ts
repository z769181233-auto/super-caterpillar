import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto, UpdateCharacterDto, RecordAppearanceDto } from './character.dto';
import { LoraTrainingService } from './lora-training.service';

@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(LoraTrainingService) private loraTrainingService: LoraTrainingService
  ) {
    this.logger.log(`[DEBUG] CharacterService constructor. Prisma defined: ${!!this.prisma}`);
  }

  /**
   * 创建角色档案
   */
  async create(projectId: string, dto: CreateCharacterDto) {
    this.logger.log(`[DEBUG] CharacterService.create. Prisma defined: ${!!this.prisma}`);
    if (this.prisma) {
      this.logger.log(
        `[DEBUG] Prisma keys: ${Object.keys(this.prisma)
          .filter((k) => !k.startsWith('_'))
          .join(', ')}`
      );
      this.logger.log(`[DEBUG] characterProfile in prisma: ${'characterProfile' in this.prisma}`);
      this.logger.log(
        `[DEBUG] characterProfile value: ${typeof (this.prisma as any).characterProfile}`
      );
    }

    if (!this.prisma) {
      this.logger.error('[DEBUG] Prisma is UNDEFINED in CharacterService.create');
      throw new Error('Internal Server Error: Prisma not initialized');
    }

    // 检查是否已存在同名角色
    const existing = await (this.prisma as any).characterProfile.findFirst({
      where: {
        projectId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(`Character "${dto.name}" already exists in this project`);
    }

    return this.prisma.characterProfile.create({
      data: {
        projectId,
        name: dto.name,
        nameEn: dto.nameEn,
        role: dto.role,
        description: dto.description,
        baseImageUrl: dto.baseImageUrl,
        basePrompt: dto.basePrompt,
        attributes: dto.attributes as any,
        timeline: dto.timeline as any,
      },
    });
  }

  /**
   * 获取项目所有角色
   */
  async findAll(projectId: string) {
    return this.prisma.characterProfile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取单个角色
   */
  async findOne(characterId: string) {
    const character = await this.prisma.characterProfile.findUnique({
      where: { id: characterId },
      include: {
        appearances: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!character) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }

    return character;
  }

  /**
   * 更新角色
   */
  async update(characterId: string, dto: UpdateCharacterDto) {
    try {
      return await this.prisma.characterProfile.update({
        where: { id: characterId },
        data: {
          name: dto.name,
          nameEn: dto.nameEn,
          role: dto.role,
          description: dto.description,
          baseImageUrl: dto.baseImageUrl,
          basePrompt: dto.basePrompt,
          attributes: dto.attributes as any,
          timeline: dto.timeline as any,
          loraModelId: dto.loraModelId,
          loraTrainingStatus: dto.loraTrainingStatus,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }
  }

  /**
   * 删除角色
   */
  async remove(characterId: string) {
    try {
      return await this.prisma.characterProfile.delete({
        where: { id: characterId },
      });
    } catch (error) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }
  }

  /**
   * 获取角色所有出现记录
   */
  async getAppearances(characterId: string, limit = 50) {
    const character = await this.prisma.characterProfile.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }

    return this.prisma.characterAppearance.findMany({
      where: { characterId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        shot: {
          select: {
            id: true,
            title: true,
            sceneId: true,
          },
        },
      },
    });
  }

  /**
   * 记录角色在 Shot 中的出现
   */
  async recordAppearance(characterId: string, dto: RecordAppearanceDto) {
    const character = await this.prisma.characterProfile.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }

    // 创建或更新 Appearance
    const appearance = await this.prisma.characterAppearance.upsert({
      where: {
        characterId_shotId: {
          characterId,
          shotId: dto.shotId,
        },
      },
      create: {
        characterId,
        shotId: dto.shotId,
        renderedImageUrl: dto.renderedImageUrl,
        promptUsed: dto.promptUsed,
        consistencyScore: dto.consistencyScore,
        evaluatedAt: dto.consistencyScore ? new Date() : null,
      },
      update: {
        renderedImageUrl: dto.renderedImageUrl,
        promptUsed: dto.promptUsed,
        consistencyScore: dto.consistencyScore,
        evaluatedAt: dto.consistencyScore ? new Date() : null,
      },
    });

    // 更新角色统计
    await this.updateCharacterStats(characterId);

    // B2.2: 检查是否需要触发 LoRA 训练
    if (dto.consistencyScore && dto.consistencyScore < 0.7) {
      this.logger.warn(`[${characterId}] Low consistency score detected: ${dto.consistencyScore}`);
      await this.checkAndTriggerTraining(characterId);
    }

    return appearance;
  }

  /**
   * 更新角色统计信息
   */
  private async updateCharacterStats(characterId: string) {
    const appearances = await this.prisma.characterAppearance.findMany({
      where: { characterId },
      select: { consistencyScore: true },
    });

    const totalShots = appearances.length;
    const validScores = appearances
      .map((a) => a.consistencyScore)
      .filter((s) => s !== null) as number[];

    const avgConsistencyScore =
      validScores.length > 0
        ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length
        : null;

    await this.prisma.characterProfile.update({
      where: { id: characterId },
      data: {
        totalShots,
        avgConsistencyScore,
      },
    });
  }

  /**
   * 收集训练集图片
   */
  async collectTrainingImages(characterId: string, minScore = 0.7) {
    const appearances = await this.prisma.characterAppearance.findMany({
      where: {
        characterId,
        consistencyScore: {
          gte: minScore,
        },
        usedForTraining: false,
      },
      orderBy: {
        consistencyScore: 'desc',
      },
      take: 20, // 最多20张图片
    });

    return appearances
      .filter((a) => a.consistencyScore !== null)
      .map((a) => ({
        imageUrl: a.renderedImageUrl,
        score: a.consistencyScore as number,
        shotId: a.shotId,
      }));
  }

  /**
   * B2.2: 检查并触发 LoRA 训练
   */
  async checkAndTriggerTraining(characterId: string): Promise<void> {
    if (!this.loraTrainingService.isEnabled()) {
      return;
    }

    const character = await this.prisma.characterProfile.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      return;
    }

    // 检查触发条件
    const minConsistencyScore = parseFloat(process.env.MIN_CONSISTENCY_SCORE || '0.7');
    const minTrainingImages = parseInt(process.env.MIN_TRAINING_IMAGES || '10', 10);
    const trainingCooldownHours = parseInt(process.env.TRAINING_COOLDOWN_HOURS || '24', 10);

    const shouldTrain =
      (character.avgConsistencyScore ?? 1) < minConsistencyScore &&
      character.totalShots >= minTrainingImages &&
      character.loraTrainingStatus !== 'training' &&
      (!character.loraLastTrained ||
        Date.now() - character.loraLastTrained.getTime() > trainingCooldownHours * 60 * 60 * 1000);

    if (!shouldTrain) {
      this.logger.debug(
        `[${characterId}] Training not triggered: ` +
          `score=${character.avgConsistencyScore}, ` +
          `shots=${character.totalShots}, ` +
          `status=${character.loraTrainingStatus}`
      );
      return;
    }

    try {
      this.logger.log(
        `[${characterId}] Auto-triggering LoRA training ` +
          `(avgScore: ${character.avgConsistencyScore}, shots: ${character.totalShots})`
      );

      const trainingImages = await this.collectTrainingImages(characterId, minConsistencyScore);

      if (trainingImages.length < minTrainingImages) {
        this.logger.warn(
          `[${characterId}] Not enough high-quality images: ` +
            `${trainingImages.length} < ${minTrainingImages}`
        );
        return;
      }

      await this.loraTrainingService.submitTraining(characterId, trainingImages);
    } catch (error: any) {
      this.logger.error(`[${characterId}] Failed to auto-trigger training: ${error.message}`);
    }
  }
}
