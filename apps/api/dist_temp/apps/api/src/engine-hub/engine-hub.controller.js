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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EngineHubController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineHubController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const shared_types_1 = require("@scu/shared-types");
const engine_invoker_hub_service_1 = require("./engine-invoker-hub.service");
const core_1 = require("@nestjs/core");
let EngineHubController = EngineHubController_1 = class EngineHubController {
    moduleRef;
    engineInvoker;
    logger = new common_1.Logger(EngineHubController_1.name);
    constructor(moduleRef, engineInvoker) {
        this.moduleRef = moduleRef;
        this.engineInvoker = engineInvoker;
        console.log(`[EngineHubController] Initialized. engineInvoker defined: ${!!this.engineInvoker}`);
    }
    async invoke(req) {
        const jobId = req.metadata?.jobId;
        process.stdout.write(`\n!!! [15M-TRACE-ENTRY] JobId: ${jobId} !!!\n`);
        console.error(`!!! [15M-DEBUG] JobId: ${jobId} Entry. Keys: ${Object.keys(req.payload || {}).join(',')}`);
        if (req.payload?.raw_text) {
            console.error(`!!! [15M-DEBUG] raw_text len: ${req.payload.raw_text.length}`);
        }
        else if (req.payload?.structured_text) {
            console.error(`!!! [15M-DEBUG] structured_text len: ${req.payload.structured_text.length}`);
        }
        else {
            console.error(`!!! [15M-DEBUG] NO TEXT FOUND IN PAYLOAD`);
        }
        if (!this.engineInvoker) {
            this.engineInvoker = this.moduleRef.get(engine_invoker_hub_service_1.EngineInvokerHubService, { strict: false });
        }
        try {
            const result = await this.engineInvoker.invoke(req);
            process.stdout.write(`!!! [15M-TRACE-EXIT] JobId: ${jobId} SUCCESS !!!\n`);
            return { success: true, data: result };
        }
        catch (e) {
            process.stdout.write(`!!! [15M-TRACE-CRASH] JobId: ${jobId} ERROR: ${e.message} !!!\n`);
            console.error(`!!! [15M-STACK] JobId: ${jobId}`, e);
            throw e;
        }
    }
};
exports.EngineHubController = EngineHubController;
__decorate([
    (0, common_1.Post)('invoke'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [shared_types_1.EngineInvocationRequest]),
    __metadata("design:returntype", Promise)
], EngineHubController.prototype, "invoke", null);
exports.EngineHubController = EngineHubController = EngineHubController_1 = __decorate([
    (0, common_1.Controller)('_internal/engine'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(1, (0, common_1.Inject)(engine_invoker_hub_service_1.EngineInvokerHubService)),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        engine_invoker_hub_service_1.EngineInvokerHubService])
], EngineHubController);
//# sourceMappingURL=engine-hub.controller.js.map