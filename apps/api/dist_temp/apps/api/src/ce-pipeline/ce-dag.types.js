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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEDagStatus = exports.CEDagRunRequestDto = void 0;
const class_validator_1 = require("class-validator");
class CEDagRunRequestDto {
    projectId;
    novelSourceId;
    shotId;
    rawText;
    runId;
    traceId;
    referenceSheetId;
}
exports.CEDagRunRequestDto = CEDagRunRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "novelSourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "shotId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "rawText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "runId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "traceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CEDagRunRequestDto.prototype, "referenceSheetId", void 0);
var CEDagStatus;
(function (CEDagStatus) {
    CEDagStatus["PENDING"] = "PENDING";
    CEDagStatus["CE06_RUNNING"] = "CE06_RUNNING";
    CEDagStatus["CE03_RUNNING"] = "CE03_RUNNING";
    CEDagStatus["CE04_RUNNING"] = "CE04_RUNNING";
    CEDagStatus["RENDERING_SHOTS"] = "RENDERING_SHOTS";
    CEDagStatus["COMPOSING_VIDEO"] = "COMPOSING_VIDEO";
    CEDagStatus["SUCCEEDED"] = "SUCCEEDED";
    CEDagStatus["FAILED"] = "FAILED";
})(CEDagStatus || (exports.CEDagStatus = CEDagStatus = {}));
//# sourceMappingURL=ce-dag.types.js.map