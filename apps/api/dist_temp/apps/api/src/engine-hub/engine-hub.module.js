"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineHubModule = void 0;
const common_1 = require("@nestjs/common");
const engine_registry_hub_service_1 = require("./engine-registry-hub.service");
const engine_invoker_hub_service_1 = require("./engine-invoker-hub.service");
const engine_hub_controller_1 = require("./engine-hub.controller");
const engine_module_1 = require("../engines/engine.module");
const http_engine_adapter_1 = require("../engine/adapters/http-engine.adapter");
const semantic_enhancement_local_adapter_1 = require("./adapters/semantic-enhancement.local-adapter");
const shot_planning_local_adapter_1 = require("./adapters/shot-planning.local-adapter");
const structure_qa_local_adapter_1 = require("./adapters/structure-qa.local-adapter");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const auth_module_1 = require("../auth/auth.module");
const hmac_auth_module_1 = require("../auth/hmac/hmac-auth.module");
const cost_module_1 = require("../cost/cost.module");
let EngineHubModule = class EngineHubModule {
};
exports.EngineHubModule = EngineHubModule;
exports.EngineHubModule = EngineHubModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => engine_module_1.EngineModule), audit_log_module_1.AuditLogModule, auth_module_1.AuthModule, hmac_auth_module_1.HmacAuthModule, cost_module_1.CostModule],
        controllers: [engine_hub_controller_1.EngineHubController],
        providers: [
            engine_registry_hub_service_1.EngineRegistryHubService,
            engine_invoker_hub_service_1.EngineInvokerHubService,
            semantic_enhancement_local_adapter_1.SemanticEnhancementLocalAdapter,
            shot_planning_local_adapter_1.ShotPlanningLocalAdapter,
            structure_qa_local_adapter_1.StructureQALocalAdapter,
            http_engine_adapter_1.HttpEngineAdapter,
        ],
        exports: [engine_registry_hub_service_1.EngineRegistryHubService, engine_invoker_hub_service_1.EngineInvokerHubService],
    })
], EngineHubModule);
//# sourceMappingURL=engine-hub.module.js.map