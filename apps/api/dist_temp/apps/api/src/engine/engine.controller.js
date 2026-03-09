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
exports.EngineController = void 0;
const common_1 = require("@nestjs/common");
const engine_config_store_service_1 = require("./engine-config-store.service");
const engine_admin_service_1 = require("../engine-admin/engine-admin.service");
let EngineController = class EngineController {
    engineConfigStore;
    engineAdminService;
    constructor(engineConfigStore, engineAdminService) {
        this.engineConfigStore = engineConfigStore;
        this.engineAdminService = engineAdminService;
    }
    async list() {
        const engines = await this.engineAdminService.list();
        const publicData = engines.map((engine) => ({
            engineKey: engine.engineKey,
            adapterName: engine.adapterName,
            adapterType: engine.adapterType,
            defaultVersion: engine.defaultVersion,
            versions: engine.versions?.map((v) => ({
                versionName: v.versionName,
                enabled: v.enabled,
            })) || [],
            enabled: engine.enabled ?? true,
        }));
        return { success: true, data: publicData };
    }
};
exports.EngineController = EngineController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "list", null);
exports.EngineController = EngineController = __decorate([
    (0, common_1.Controller)('engines'),
    __metadata("design:paramtypes", [engine_config_store_service_1.EngineConfigStoreService,
        engine_admin_service_1.EngineAdminService])
], EngineController);
//# sourceMappingURL=engine.controller.js.map