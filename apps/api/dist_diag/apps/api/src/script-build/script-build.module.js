"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptBuildModule = void 0;
const common_1 = require("@nestjs/common");
const script_build_controller_1 = require("./script-build.controller");
const script_build_service_1 = require("./script-build.service");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
let ScriptBuildModule = class ScriptBuildModule {
};
exports.ScriptBuildModule = ScriptBuildModule;
exports.ScriptBuildModule = ScriptBuildModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, auth_module_1.AuthModule],
        controllers: [script_build_controller_1.ScriptBuildController, script_build_controller_1.ShotsController],
        providers: [script_build_service_1.ScriptBuildService],
        exports: [script_build_service_1.ScriptBuildService],
    })
], ScriptBuildModule);
//# sourceMappingURL=script-build.module.js.map