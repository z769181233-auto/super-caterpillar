"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.V3Module = void 0;
const common_1 = require("@nestjs/common");
const project_module_1 = require("../project/project.module");
const orchestrator_module_1 = require("../orchestrator/orchestrator.module");
const contract_story_controller_1 = require("./contract-story.controller");
const contract_shot_controller_1 = require("./contract-shot.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const story_module_1 = require("../story/story.module");
const job_module_1 = require("../job/job.module");
const asset_receipt_resolver_service_1 = require("./asset-receipt-resolver.service");
let V3Module = class V3Module {
};
exports.V3Module = V3Module;
exports.V3Module = V3Module = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, project_module_1.ProjectModule, orchestrator_module_1.OrchestratorModule, story_module_1.StoryModule, job_module_1.JobModule],
        controllers: [contract_story_controller_1.ContractStoryController, contract_shot_controller_1.ContractShotController],
        providers: [asset_receipt_resolver_service_1.AssetReceiptResolverService],
    })
], V3Module);
//# sourceMappingURL=v3.module.js.map