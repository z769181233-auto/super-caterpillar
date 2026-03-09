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
exports.CreateEpisodeDto = void 0;
const class_validator_1 = require("class-validator");
class CreateEpisodeDto {
    index;
    name;
    title;
    summary;
}
exports.CreateEpisodeDto = CreateEpisodeDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1, { message: 'Episode index must be at least 1' }),
    __metadata("design:type", Number)
], CreateEpisodeDto.prototype, "index", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Episode name must not be empty' }),
    (0, class_validator_1.MaxLength)(200, { message: 'Episode name must not exceed 200 characters' }),
    __metadata("design:type", String)
], CreateEpisodeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Episode title must not be empty' }),
    (0, class_validator_1.MaxLength)(200, { message: 'Episode title must not exceed 200 characters' }),
    __metadata("design:type", String)
], CreateEpisodeDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000, { message: 'Episode summary must not exceed 2000 characters' }),
    __metadata("design:type", String)
], CreateEpisodeDto.prototype, "summary", void 0);
//# sourceMappingURL=create-episode.dto.js.map