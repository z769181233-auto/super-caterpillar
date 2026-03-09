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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEDagController = void 0;
const common_1 = require("@nestjs/common");
const ce_dag_orchestrator_service_1 = require("./ce-dag-orchestrator.service");
const ce_dag_types_1 = require("./ce-dag.types");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
let CEDagController = class CEDagController {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async runCEDag(request) {
        console.log(`[CE_DAG_CONTROLLER] [DEBUG] Entering runCEDag with request for shotId=${request.shotId}`);
        try {
            const result = await this.orchestrator.runCEDag(request);
            console.log(`[CE_DAG_CONTROLLER] [DEBUG] Returning success result`);
            return result;
        }
        catch (error) {
            console.error(`[CE_DAG_CONTROLLER] [DEBUG] CAUGHT ERROR: ${error.message}`);
            throw error;
        }
    }
};
exports.CEDagController = CEDagController;
__decorate([
    (0, common_1.Post)('run'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ce_dag_types_1.CEDagRunRequestDto]),
    __metadata("design:returntype", Promise)
], CEDagController.prototype, "runCEDag", null);
exports.CEDagController = CEDagController = __decorate([
    (0, common_1.Controller)('ce-dag'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [ce_dag_orchestrator_service_1.CEDagOrchestratorService])
], CEDagController);
//# sourceMappingURL=ce-dag.controller.js.map