import Replicate from 'replicate';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TrainingConfig {
  minConsistencyScore?: number;
  maxTrainSteps?: number;
  resolution?: number;
  forceRetrain?: boolean;
}

export interface TrainingStatus {
  status: string;
  progress?: number;
  error?: string;
  completedAt?: Date;
}

@Injectable()
export class LoraTrainingService {
  private readonly logger = new Logger(LoraTrainingService.name);
  private replicate: Replicate | null = null;
  private enabled: boolean;

  constructor(private prisma: PrismaService) {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    this.enabled = process.env.ENABLE_AUTO_LORA_TRAINING === '1' && !!apiToken;

    if (this.enabled && apiToken) {
      this.replicate = new Replicate({ auth: apiToken });
      this.logger.log('LoRA Training Service initialized with Replicate API');
    } else {
      this.logger.warn(
        'LoRA Training Service disabled (missing REPLICATE_API_TOKEN or ENABLE_AUTO_LORA_TRAINING)'
      );
    }
  }

  /**
   * 提交 LoRA 训练任务
   */
  async submitTraining(
    characterId: string,
    trainingImages: Array<{ imageUrl: string; score: number }>,
    config: TrainingConfig = {}
  ): Promise<string | null> {
    if (!this.enabled || !this.replicate) {
      this.logger.warn(`[${characterId}] LoRA training is disabled, skipping`);
      return null;
    }

    const character = await this.prisma.characterProfile.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    if (trainingImages.length < 10) {
      throw new Error(
        `Not enough high-quality images for training (${trainingImages.length} < 10)`
      );
    }

    try {
      this.logger.log(
        `[${characterId}] Submitting LoRA training with ${trainingImages.length} images`
      );

      // 准备训练数据（这里简化处理，实际需要上传到可访问的 URL）
      const imageUrls = trainingImages.map((img) => img.imageUrl);
      const triggerWord = character.nameEn || character.name;

      // 提交训练任务
      // 注意：这里使用 Replicate 的 LoRA 训练模型
      // 实际 model owner/name 需要根据具体情况调整
      const training = await this.replicate.trainings.create(
        'ostris',
        'flux-dev-lora-trainer',
        'e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497',
        {
          destination: `${process.env.REPLICATE_USERNAME || 'default'}/${character.nameEn || characterId}`,
          input: {
            input_images: imageUrls.join(','),
            trigger_word: triggerWord,
            max_train_steps: config.maxTrainSteps || 1000,
            resolution: config.resolution || 1024,
          },
        }
      );

      // 保存训练 ID
      await this.prisma.characterProfile.update({
        where: { id: characterId },
        data: {
          loraTrainingStatus: 'training',
          loraModelId: training.id,
        },
      });

      this.logger.log(`[${characterId}] Training submitted: ${training.id}`);
      return training.id;
    } catch (error: any) {
      this.logger.error(`[${characterId}] Failed to submit training: ${error.message}`);

      await this.prisma.characterProfile.update({
        where: { id: characterId },
        data: {
          loraTrainingStatus: 'failed',
        },
      });

      throw error;
    }
  }

  /**
   * 查询训练状态
   */
  async getTrainingStatus(characterId: string): Promise<TrainingStatus | null> {
    if (!this.enabled || !this.replicate) {
      return { status: 'disabled' };
    }

    const character = await this.prisma.characterProfile.findUnique({
      where: { id: characterId },
    });

    if (!character?.loraModelId) {
      return null;
    }

    try {
      const training = await this.replicate.trainings.get(character.loraModelId);

      // 更新数据库状态
      const updateData: any = {
        loraTrainingStatus: training.status,
      };

      if (training.status === 'succeeded') {
        updateData.loraLastTrained = new Date();
        updateData.loraModelId = training.output?.version || character.loraModelId;
      }

      await this.prisma.characterProfile.update({
        where: { id: characterId },
        data: updateData,
      });

      return {
        status: training.status,
        progress: this.calculateProgress(training),
        error: training.error as string | undefined,
        completedAt: training.completed_at ? new Date(training.completed_at) : undefined,
      };
    } catch (error: any) {
      this.logger.error(`[${characterId}] Failed to fetch training status: ${error.message}`);
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * 计算训练进度
   */
  private calculateProgress(training: any): number {
    if (training.status === 'succeeded') return 100;
    if (training.status === 'failed' || training.status === 'canceled') return 0;

    // 简化：基于日志估算进度
    const logs = training.logs || '';
    const matches = logs.match(/step (\d+)\/(\d+)/);
    if (matches) {
      const current = parseInt(matches[1], 10);
      const total = parseInt(matches[2], 10);
      return Math.floor((current / total) * 100);
    }

    return training.status === 'processing' ? 50 : 10;
  }

  /**
   * 检查服务是否可用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
