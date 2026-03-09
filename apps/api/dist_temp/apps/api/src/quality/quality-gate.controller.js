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
var QualityGateController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityGateController = void 0;
const common_1 = require("@nestjs/common");
const quality_score_service_1 = require("./quality-score.service");
const quality_backfill_sweeper_1 = require("./quality-backfill.sweeper");
let QualityGateController = QualityGateController_1 = class QualityGateController {
    qualityScoreService;
    qualitySweeper;
    logger = new common_1.Logger(QualityGateController_1.name);
    constructor(qualityScoreService, qualitySweeper) {
        this.qualityScoreService = qualityScoreService;
        this.qualitySweeper = qualitySweeper;
    }
    async triggerScoring(body) {
        this.logger.log(`Manual scoring triggered for shot ${body.shotId}`);
        return await this.qualityScoreService.performScoring(body.shotId, body.traceId, body.attempt || 1);
    }
    async triggerSweep() {
        this.logger.log(`Manual quality sweep triggered`);
        await this.qualitySweeper.backfillQualityScores();
        return { status: 'OK' };
    }
};
exports.QualityGateController = QualityGateController;
__decorate([
    (0, common_1.Post)('score'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QualityGateController.prototype, "triggerScoring", null);
__decorate([
    (0, common_1.Post)('sweep'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QualityGateController.prototype, "triggerSweep", null);
exports.QualityGateController = QualityGateController = QualityGateController_1 = __decorate([
    (0, common_1.Controller)('quality'),
    __metadata("design:paramtypes", [quality_score_service_1.QualityScoreService,
        quality_backfill_sweeper_1.QualityBackfillSweeper])
], QualityGateController);
//# sourceMappingURL=quality-gate.controller.js.map