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
var EngineInvokerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineInvokerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
let EngineInvokerService = EngineInvokerService_1 = class EngineInvokerService {
    prisma;
    engineConfigStore;
    logger = new common_1.Logger(EngineInvokerService_1.name);
    circuitBreaker = new Map();
    FAILURE_THRESHOLD = 5;
    RECOVERY_TIMEOUT_MS = 300000;
    constructor(prisma, engineConfigStore) {
        this.prisma = prisma;
        this.engineConfigStore = engineConfigStore;
    }
    async invoke({ adapter, input, engineKey }) {
        const state = this.getCircuitState(engineKey);
        const engineSpec = this.engineConfigStore.getJsonConfig(engineKey);
        if (engineSpec?.ledger_required === true || engineSpec?.ledger_required === 'YES') {
            const traceId = input.context?.traceId || input.payload?.traceId || input.jobId;
            if (!traceId) {
                throw new common_1.ForbiddenException(`[BillingGuard] Engine ${engineKey} requires a valid traceId/jobId for ledger auditing.`);
            }
            const ledger = await this.prisma.billingLedger.findFirst({
                where: { jobId: String(traceId) },
                select: { id: true },
            });
            if (!ledger) {
                this.logger.error(`[BillingGuard] ABORTING: Engine ${engineKey} is ledger_required but NO ledger entry found for traceId ${traceId}.`);
                throw new common_1.ForbiddenException(`[BillingGuard] Unauthorized usage of premium engine ${engineKey}. Ledger record must be created BEFORE invocation.`);
            }
        }
        if (state.status === 'OPEN') {
            const now = Date.now();
            if (now - state.lastErrorTime > this.RECOVERY_TIMEOUT_MS) {
                this.logger.log(`[CircuitBreaker] Engine ${engineKey} enters HALF-OPEN`);
            }
            else {
                throw new common_1.ServiceUnavailableException(`Engine ${engineKey} is currently circuited (OPEN) due to repeated failures.`);
            }
        }
        const nextInput = {
            ...input,
            engineKey,
            payload: { ...(input.payload || {}) },
            context: { ...(input.context || {}) },
        };
        try {
            const result = await adapter.invoke(nextInput);
            this.resetCircuit(engineKey);
            return result;
        }
        catch (e) {
            this.recordFailure(engineKey);
            throw e;
        }
    }
    getCircuitState(engineKey) {
        if (!this.circuitBreaker.has(engineKey)) {
            this.circuitBreaker.set(engineKey, { errors: 0, status: 'CLOSED', lastErrorTime: 0 });
        }
        return this.circuitBreaker.get(engineKey);
    }
    recordFailure(engineKey) {
        const state = this.getCircuitState(engineKey);
        state.errors++;
        state.lastErrorTime = Date.now();
        if (state.errors >= this.FAILURE_THRESHOLD) {
            state.status = 'OPEN';
            this.logger.error(`[CircuitBreaker] Engine ${engineKey} is now OPEN. Threshold reached: ${state.errors}`);
        }
    }
    resetCircuit(engineKey) {
        const state = this.getCircuitState(engineKey);
        if (state.status !== 'CLOSED') {
            this.logger.log(`[CircuitBreaker] Engine ${engineKey} recovered to CLOSED`);
        }
        state.errors = 0;
        state.status = 'CLOSED';
        state.lastErrorTime = 0;
    }
};
exports.EngineInvokerService = EngineInvokerService;
exports.EngineInvokerService = EngineInvokerService = EngineInvokerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(engine_config_store_service_1.EngineConfigStoreService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        engine_config_store_service_1.EngineConfigStoreService])
], EngineInvokerService);
//# sourceMappingURL=engine-invoker.service.js.map