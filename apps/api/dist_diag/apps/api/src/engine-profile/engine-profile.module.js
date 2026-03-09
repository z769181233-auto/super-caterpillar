"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineProfileModule = void 0;
const common_1 = require("@nestjs/common");
const engine_profile_controller_1 = require("./engine-profile.controller");
const engine_profile_service_1 = require("./engine-profile.service");
const prisma_module_1 = require("../prisma/prisma.module");
const job_module_1 = require("../job/job.module");
const engine_hub_module_1 = require("../engine-hub/engine-hub.module");
const auth_module_1 = require("../auth/auth.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
let EngineProfileModule = class EngineProfileModule {
};
exports.EngineProfileModule = EngineProfileModule;
exports.EngineProfileModule = EngineProfileModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            job_module_1.JobModule,
            engine_hub_module_1.EngineHubModule,
            auth_module_1.AuthModule,
            api_security_module_1.ApiSecurityModule,
        ],
        controllers: [engine_profile_controller_1.EngineProfileController],
        providers: [engine_profile_service_1.EngineProfileService],
        exports: [engine_profile_service_1.EngineProfileService],
    })
], EngineProfileModule);
//# sourceMappingURL=engine-profile.module.js.map