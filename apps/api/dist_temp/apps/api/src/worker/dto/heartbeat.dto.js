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
exports.HeartbeatDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("database");
class HeartbeatDto {
    status;
    tasksRunning;
    temperature;
    capabilities;
    cpuUsagePercent;
    memoryUsageMb;
    queueDepth;
    avgProcessingTimeMs;
    metadata;
}
exports.HeartbeatDto = HeartbeatDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.WorkerStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], HeartbeatDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], HeartbeatDto.prototype, "tasksRunning", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], HeartbeatDto.prototype, "temperature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], HeartbeatDto.prototype, "capabilities", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], HeartbeatDto.prototype, "cpuUsagePercent", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], HeartbeatDto.prototype, "memoryUsageMb", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], HeartbeatDto.prototype, "queueDepth", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], HeartbeatDto.prototype, "avgProcessingTimeMs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], HeartbeatDto.prototype, "metadata", void 0);
//# sourceMappingURL=heartbeat.dto.js.map