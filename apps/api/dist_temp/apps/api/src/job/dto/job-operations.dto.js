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
exports.BatchJobOperationDto = exports.BatchForceFailJobsDto = exports.BatchCancelJobsDto = exports.BatchRetryJobsDto = exports.ForceFailJobDto = exports.RetryJobDto = void 0;
const class_validator_1 = require("class-validator");
class RetryJobDto {
    resetAttempts;
}
exports.RetryJobDto = RetryJobDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], RetryJobDto.prototype, "resetAttempts", void 0);
class ForceFailJobDto {
    message;
}
exports.ForceFailJobDto = ForceFailJobDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ForceFailJobDto.prototype, "message", void 0);
class BatchRetryJobsDto {
    jobIds;
}
exports.BatchRetryJobsDto = BatchRetryJobsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BatchRetryJobsDto.prototype, "jobIds", void 0);
class BatchCancelJobsDto {
    jobIds;
}
exports.BatchCancelJobsDto = BatchCancelJobsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BatchCancelJobsDto.prototype, "jobIds", void 0);
class BatchForceFailJobsDto {
    jobIds;
    note;
}
exports.BatchForceFailJobsDto = BatchForceFailJobsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BatchForceFailJobsDto.prototype, "jobIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BatchForceFailJobsDto.prototype, "note", void 0);
class BatchJobOperationDto {
    jobIds;
    note;
}
exports.BatchJobOperationDto = BatchJobOperationDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BatchJobOperationDto.prototype, "jobIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BatchJobOperationDto.prototype, "note", void 0);
//# sourceMappingURL=job-operations.dto.js.map