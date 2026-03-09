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
var JobEngineBindingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobEngineBindingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const config_1 = require("@scu/config");
const database_1 = require("database");
let JobEngineBindingService = JobEngineBindingService_1 = class JobEngineBindingService {
    prisma;
    engineConfigStore;
    engineRegistry;
    logger = new common_1.Logger(JobEngineBindingService_1.name);
    constructor(prisma, engineConfigStore, engineRegistry) {
        this.prisma = prisma;
        this.engineConfigStore = engineConfigStore;
        this.engineRegistry = engineRegistry;
    }
    async selectEngineForJob(jobType) {
        const engineKey = this.engineRegistry.getDefaultEngineKeyForJobType(jobType);
        if (!engineKey) {
            this.logger.warn(`No engine key mapped for jobType: ${jobType}`);
            return null;
        }
        const engine = await this.prisma.engine.findFirst({
            where: {
                engineKey,
                isActive: true,
                enabled: true,
            },
        });
        if (!engine) {
            this.logger.warn(`No active engine found for engineKey: ${engineKey}, jobType: ${jobType}`);
            return null;
        }
        if (config_1.PRODUCTION_MODE) {
            const isStub = !engine.mode || engine.mode !== 'http';
            const isDefault = engine.code.startsWith('default_') || engineKey.startsWith('default_');
            if (isStub || isDefault) {
                this.logger.error(`[ZeroBypass] PRODUCTION_MODE blocked engine binding. Key: ${engineKey}, Mode: ${engine.mode}, Code: ${engine.code}`);
                await this.prisma.auditLog
                    .create({
                    data: {
                        action: 'PRODUCTION_BLOCK_ENGINE_BINDING',
                        resourceType: 'engine',
                        resourceId: engine.id,
                        details: { engineKey, mode: engine.mode, code: engine.code },
                    },
                })
                    .catch(() => { });
                throw new Error(`PRODUCTION_MODE_FORBIDS_NON_PROD_ENGINE: ${engineKey} (Mode=${engine.mode}, Code=${engine.code})`);
            }
        }
        let engineVersionId;
        if (engine.defaultVersion) {
            const version = await this.prisma.engineVersion.findFirst({
                where: {
                    engineId: engine.id,
                    versionName: engine.defaultVersion,
                    enabled: true,
                },
            });
            if (version) {
                engineVersionId = version.id;
            }
        }
        return {
            engineId: engine.id,
            engineKey: engine.engineKey || engine.code,
            engineVersionId,
        };
    }
    async bindEngineToJob(jobId, engineId, engineKey, engineVersionId, metadata) {
        const binding = await this.prisma.jobEngineBinding.create({
            data: {
                jobId,
                engineId,
                engineKey,
                engineVersionId,
                status: database_1.JobEngineBindingStatus.BOUND,
                metadata: metadata || {},
            },
        });
        this.logger.log(`Bound engine ${engineKey} to job ${jobId}`);
        return binding;
    }
    async getBindingForJob(jobId) {
        const binding = await this.prisma.jobEngineBinding.findUnique({
            where: { jobId },
            include: {
                engine: true,
                engineVersion: true,
            },
        });
        if (!binding) {
            throw new common_1.NotFoundException(`No engine binding found for job ${jobId}`);
        }
        return binding;
    }
    async markBindingExecuting(jobId) {
        return this.prisma.jobEngineBinding.update({
            where: { jobId },
            data: {
                status: database_1.JobEngineBindingStatus.EXECUTING,
                executedAt: new Date(),
            },
        });
    }
    async markBindingCompleted(jobId) {
        return this.prisma.jobEngineBinding.update({
            where: { jobId },
            data: {
                status: database_1.JobEngineBindingStatus.COMPLETED,
                completedAt: new Date(),
            },
        });
    }
    async markBindingFailed(jobId, errorMessage) {
        return this.prisma.jobEngineBinding.update({
            where: { jobId },
            data: {
                status: database_1.JobEngineBindingStatus.FAILED,
                errorMessage,
                completedAt: new Date(),
            },
        });
    }
};
exports.JobEngineBindingService = JobEngineBindingService;
exports.JobEngineBindingService = JobEngineBindingService = JobEngineBindingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(engine_config_store_service_1.EngineConfigStoreService)),
    __param(2, (0, common_1.Inject)(engine_registry_service_1.EngineRegistry)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        engine_config_store_service_1.EngineConfigStoreService,
        engine_registry_service_1.EngineRegistry])
], JobEngineBindingService);
//# sourceMappingURL=job-engine-binding.service.js.map