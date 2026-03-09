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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterController = void 0;
const common_1 = require("@nestjs/common");
const character_service_1 = require("./character.service");
const character_dto_1 = require("./character.dto");
let CharacterController = class CharacterController {
    characterService;
    constructor(characterService) {
        this.characterService = characterService;
    }
    async create(projectId, dto) {
        return this.characterService.create(projectId, dto);
    }
    async findAll(projectId) {
        return this.characterService.findAll(projectId);
    }
    async findOne(characterId) {
        return this.characterService.findOne(characterId);
    }
    async update(characterId, dto) {
        return this.characterService.update(characterId, dto);
    }
    async remove(characterId) {
        await this.characterService.remove(characterId);
    }
    async getAppearances(characterId, limit) {
        return this.characterService.getAppearances(characterId, limit ? parseInt(limit.toString(), 10) : 50);
    }
    async recordAppearance(characterId, dto) {
        return this.characterService.recordAppearance(characterId, dto);
    }
    async getTrainingImages(characterId, minScore) {
        return this.characterService.collectTrainingImages(characterId, minScore ? parseFloat(minScore.toString()) : 0.7);
    }
    async trainLora(characterId, dto) {
        return {
            message: 'LoRA training will be implemented in B2.2',
            characterId,
            dto,
        };
    }
};
exports.CharacterController = CharacterController;
__decorate([
    (0, common_1.Post)('projects/:projectId/characters'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, character_dto_1.CreateCharacterDto]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/characters'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('characters/:characterId'),
    __param(0, (0, common_1.Param)('characterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('characters/:characterId'),
    __param(0, (0, common_1.Param)('characterId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, character_dto_1.UpdateCharacterDto]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('characters/:characterId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('characterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('characters/:characterId/appearances'),
    __param(0, (0, common_1.Param)('characterId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "getAppearances", null);
__decorate([
    (0, common_1.Post)('characters/:characterId/appearances'),
    __param(0, (0, common_1.Param)('characterId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, character_dto_1.RecordAppearanceDto]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "recordAppearance", null);
__decorate([
    (0, common_1.Get)('characters/:characterId/training-images'),
    __param(0, (0, common_1.Param)('characterId')),
    __param(1, (0, common_1.Query)('minScore')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "getTrainingImages", null);
__decorate([
    (0, common_1.Post)('characters/:characterId/train'),
    __param(0, (0, common_1.Param)('characterId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, character_dto_1.TrainLoraDto]),
    __metadata("design:returntype", Promise)
], CharacterController.prototype, "trainLora", null);
exports.CharacterController = CharacterController = __decorate([
    (0, common_1.Controller)('v1'),
    __metadata("design:paramtypes", [character_service_1.CharacterService])
], CharacterController);
//# sourceMappingURL=character.controller.js.map