"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextSafetyModule = void 0;
const common_1 = require("@nestjs/common");
const text_safety_service_1 = require("./text-safety.service");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const feature_flag_module_1 = require("../feature-flag/feature-flag.module");
const prisma_module_1 = require("../prisma/prisma.module");
let TextSafetyModule = class TextSafetyModule {
};
exports.TextSafetyModule = TextSafetyModule;
exports.TextSafetyModule = TextSafetyModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, feature_flag_module_1.FeatureFlagModule, prisma_module_1.PrismaModule],
        providers: [text_safety_service_1.TextSafetyService],
        exports: [text_safety_service_1.TextSafetyService],
    })
], TextSafetyModule);
//# sourceMappingURL=text-safety.module.js.map