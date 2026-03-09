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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CharacterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const lora_training_service_1 = require("./lora-training.service");
let CharacterService = CharacterService_1 = class CharacterService {
    prisma;
    loraTrainingService;
    logger = new common_1.Logger(CharacterService_1.name);
    constructor(prisma, loraTrainingService) {
        this.prisma = prisma;
        this.loraTrainingService = loraTrainingService;
        this.logger.log(`[DEBUG] CharacterService constructor. Prisma defined: ${!!this.prisma}`);
    }
    async create(projectId, dto) {
        this.logger.log(`[DEBUG] CharacterService.create. Prisma defined: ${!!this.prisma}`);
        if (this.prisma) {
            this.logger.log(`[DEBUG] Prisma keys: ${Object.keys(this.prisma)
                .filter((k) => !k.startsWith('_'))
                .join(', ')}`);
            this.logger.log(`[DEBUG] characterProfile in prisma: ${'characterProfile' in this.prisma}`);
            this.logger.log(`[DEBUG] characterProfile value: ${typeof this.prisma.characterProfile}`);
        }
        if (!this.prisma) {
            this.logger.error('[DEBUG] Prisma is UNDEFINED in CharacterService.create');
            throw new Error('Internal Server Error: Prisma not initialized');
        }
        const existing = await this.prisma.characterProfile.findFirst({
            where: {
                projectId,
                name: dto.name,
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Character "${dto.name}" already exists in this project`);
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
                attributes: dto.attributes,
                timeline: dto.timeline,
            },
        });
    }
    async findAll(projectId) {
        return this.prisma.characterProfile.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(characterId) {
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
            throw new common_1.NotFoundException(`Character ${characterId} not found`);
        }
        return character;
    }
    async update(characterId, dto) {
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
                    attributes: dto.attributes,
                    timeline: dto.timeline,
                    loraModelId: dto.loraModelId,
                    loraTrainingStatus: dto.loraTrainingStatus,
                },
            });
        }
        catch (error) {
            throw new common_1.NotFoundException(`Character ${characterId} not found`);
        }
    }
    async remove(characterId) {
        try {
            return await this.prisma.characterProfile.delete({
                where: { id: characterId },
            });
        }
        catch (error) {
            throw new common_1.NotFoundException(`Character ${characterId} not found`);
        }
    }
    async getAppearances(characterId, limit = 50) {
        const character = await this.prisma.characterProfile.findUnique({
            where: { id: characterId },
        });
        if (!character) {
            throw new common_1.NotFoundException(`Character ${characterId} not found`);
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
    async recordAppearance(characterId, dto) {
        const character = await this.prisma.characterProfile.findUnique({
            where: { id: characterId },
        });
        if (!character) {
            throw new common_1.NotFoundException(`Character ${characterId} not found`);
        }
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
        await this.updateCharacterStats(characterId);
        if (dto.consistencyScore && dto.consistencyScore < 0.7) {
            this.logger.warn(`[${characterId}] Low consistency score detected: ${dto.consistencyScore}`);
            await this.checkAndTriggerTraining(characterId);
        }
        return appearance;
    }
    async updateCharacterStats(characterId) {
        const appearances = await this.prisma.characterAppearance.findMany({
            where: { characterId },
            select: { consistencyScore: true },
        });
        const totalShots = appearances.length;
        const validScores = appearances
            .map((a) => a.consistencyScore)
            .filter((s) => s !== null);
        const avgConsistencyScore = validScores.length > 0
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
    async collectTrainingImages(characterId, minScore = 0.7) {
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
            take: 20,
        });
        return appearances
            .filter((a) => a.consistencyScore !== null)
            .map((a) => ({
            imageUrl: a.renderedImageUrl,
            score: a.consistencyScore,
            shotId: a.shotId,
        }));
    }
    async checkAndTriggerTraining(characterId) {
        if (!this.loraTrainingService.isEnabled()) {
            return;
        }
        const character = await this.prisma.characterProfile.findUnique({
            where: { id: characterId },
        });
        if (!character) {
            return;
        }
        const minConsistencyScore = parseFloat(process.env.MIN_CONSISTENCY_SCORE || '0.7');
        const minTrainingImages = parseInt(process.env.MIN_TRAINING_IMAGES || '10', 10);
        const trainingCooldownHours = parseInt(process.env.TRAINING_COOLDOWN_HOURS || '24', 10);
        const shouldTrain = (character.avgConsistencyScore ?? 1) < minConsistencyScore &&
            character.totalShots >= minTrainingImages &&
            character.loraTrainingStatus !== 'training' &&
            (!character.loraLastTrained ||
                Date.now() - character.loraLastTrained.getTime() > trainingCooldownHours * 60 * 60 * 1000);
        if (!shouldTrain) {
            this.logger.debug(`[${characterId}] Training not triggered: ` +
                `score=${character.avgConsistencyScore}, ` +
                `shots=${character.totalShots}, ` +
                `status=${character.loraTrainingStatus}`);
            return;
        }
        try {
            this.logger.log(`[${characterId}] Auto-triggering LoRA training ` +
                `(avgScore: ${character.avgConsistencyScore}, shots: ${character.totalShots})`);
            const trainingImages = await this.collectTrainingImages(characterId, minConsistencyScore);
            if (trainingImages.length < minTrainingImages) {
                this.logger.warn(`[${characterId}] Not enough high-quality images: ` +
                    `${trainingImages.length} < ${minTrainingImages}`);
                return;
            }
            await this.loraTrainingService.submitTraining(characterId, trainingImages);
        }
        catch (error) {
            this.logger.error(`[${characterId}] Failed to auto-trigger training: ${error.message}`);
        }
    }
};
exports.CharacterService = CharacterService;
exports.CharacterService = CharacterService = CharacterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(lora_training_service_1.LoraTrainingService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        lora_training_service_1.LoraTrainingService])
], CharacterService);
//# sourceMappingURL=character.service.js.map