"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LoraTrainingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoraTrainingService = void 0;
const replicate_1 = __importDefault(require("replicate"));
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LoraTrainingService = LoraTrainingService_1 = class LoraTrainingService {
    prisma;
    logger = new common_1.Logger(LoraTrainingService_1.name);
    replicate = null;
    enabled;
    constructor(prisma) {
        this.prisma = prisma;
        const apiToken = process.env.REPLICATE_API_TOKEN;
        this.enabled = process.env.ENABLE_AUTO_LORA_TRAINING === '1' && !!apiToken;
        if (this.enabled && apiToken) {
            this.replicate = new replicate_1.default({ auth: apiToken });
            this.logger.log('LoRA Training Service initialized with Replicate API');
        }
        else {
            this.logger.warn('LoRA Training Service disabled (missing REPLICATE_API_TOKEN or ENABLE_AUTO_LORA_TRAINING)');
        }
    }
    async submitTraining(characterId, trainingImages, config = {}) {
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
            throw new Error(`Not enough high-quality images for training (${trainingImages.length} < 10)`);
        }
        try {
            this.logger.log(`[${characterId}] Submitting LoRA training with ${trainingImages.length} images`);
            const imageUrls = trainingImages.map((img) => img.imageUrl);
            const triggerWord = character.nameEn || character.name;
            const training = await this.replicate.trainings.create('ostris', 'flux-dev-lora-trainer', 'e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497', {
                destination: `${process.env.REPLICATE_USERNAME || 'default'}/${character.nameEn || characterId}`,
                input: {
                    input_images: imageUrls.join(','),
                    trigger_word: triggerWord,
                    max_train_steps: config.maxTrainSteps || 1000,
                    resolution: config.resolution || 1024,
                },
            });
            await this.prisma.characterProfile.update({
                where: { id: characterId },
                data: {
                    loraTrainingStatus: 'training',
                    loraModelId: training.id,
                },
            });
            this.logger.log(`[${characterId}] Training submitted: ${training.id}`);
            return training.id;
        }
        catch (error) {
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
    async getTrainingStatus(characterId) {
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
            const updateData = {
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
                error: training.error,
                completedAt: training.completed_at ? new Date(training.completed_at) : undefined,
            };
        }
        catch (error) {
            this.logger.error(`[${characterId}] Failed to fetch training status: ${error.message}`);
            return {
                status: 'error',
                error: error.message,
            };
        }
    }
    calculateProgress(training) {
        if (training.status === 'succeeded')
            return 100;
        if (training.status === 'failed' || training.status === 'canceled')
            return 0;
        const logs = training.logs || '';
        const matches = logs.match(/step (\d+)\/(\d+)/);
        if (matches) {
            const current = parseInt(matches[1], 10);
            const total = parseInt(matches[2], 10);
            return Math.floor((current / total) * 100);
        }
        return training.status === 'processing' ? 50 : 10;
    }
    isEnabled() {
        return this.enabled;
    }
};
exports.LoraTrainingService = LoraTrainingService;
exports.LoraTrainingService = LoraTrainingService = LoraTrainingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LoraTrainingService);
//# sourceMappingURL=lora-training.service.js.map