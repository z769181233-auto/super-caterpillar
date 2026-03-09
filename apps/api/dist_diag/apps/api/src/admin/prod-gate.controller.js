"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProdGateController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProdGateController = void 0;
const common_1 = require("@nestjs/common");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const shot_render_router_adapter_1 = require("./../engines/adapters/shot_render_router.adapter");
const orchestrator_service_1 = require("../orchestrator/orchestrator.service");
const job_service_1 = require("../job/job.service");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const path = __importStar(require("node:path"));
let ProdGateController = ProdGateController_1 = class ProdGateController {
    registry;
    shotRouter;
    orchestratorService;
    jobService;
    db;
    logger = new common_1.Logger(ProdGateController_1.name);
    constructor(registry, shotRouter, orchestratorService, jobService, db) {
        this.registry = registry;
        this.shotRouter = shotRouter;
        this.orchestratorService = orchestratorService;
        this.jobService = jobService;
        this.db = db;
    }
    resolveArtifactDir(artifactDir) {
        let repoRoot = process.env.SCU_REPO_ROOT || process.cwd();
        if (repoRoot.endsWith('apps/api')) {
            repoRoot = path.resolve(repoRoot, '../../');
        }
        const abs = path.isAbsolute(artifactDir) ? artifactDir : path.resolve(repoRoot, artifactDir);
        const allowedBase = path.resolve(repoRoot, 'docs/_evidence');
        this.logger.log(`[PathDebug] repoRoot: ${repoRoot}`);
        this.logger.log(`[PathDebug] abs: ${abs}`);
        this.logger.log(`[PathDebug] allowedBase: ${allowedBase}`);
        this.logger.log(`[PathDebug] startsWith: ${abs.startsWith(allowedBase + path.sep)}`);
        if (!abs.startsWith(allowedBase + path.sep)) {
            throw new common_1.BadRequestException(`artifactDir out of allowed base: ${abs} (Base: ${allowedBase})`);
        }
        return abs;
    }
    async networkCheck() {
        if (process.env.GATE_MODE !== '1') {
            throw new common_1.BadRequestException('Endpoint only available in GATE_MODE=1');
        }
        const dns = require('dns');
        const net = require('net');
        const checkDns = (hostname) => {
            return new Promise((resolve) => {
                dns.lookup(hostname, (err, address) => {
                    resolve({ success: !err, address, error: err?.message });
                });
            });
        };
        const checkTcp = (hostname, port) => {
            return new Promise((resolve) => {
                const start = Date.now();
                const socket = new net.Socket();
                socket.setTimeout(5000);
                socket.connect(port, hostname, () => {
                    socket.destroy();
                    resolve({ success: true, durationMs: Date.now() - start });
                });
                socket.on('error', (err) => {
                    resolve({ success: false, error: err.message });
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    resolve({ success: false, error: 'TIMEOUT' });
                });
            });
        };
        const checkPg = async () => {
            try {
                const res = await this.db.$queryRawUnsafe('SELECT 1 as "ok"');
                return { success: true, result: res };
            }
            catch (err) {
                return { success: false, error: err.message, code: err.code };
            }
        };
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            return { error: 'DATABASE_URL missing' };
        }
        let parsed;
        try {
            parsed = new URL(dbUrl);
        }
        catch (e) {
            return { error: 'Unparseable url' };
        }
        const host = parsed.hostname;
        const port = parseInt(parsed.port || '5432', 10);
        const dnsRes = await checkDns(host);
        const tcpRes = await checkTcp(host, port);
        const pgRes = await checkPg();
        return {
            dns: dnsRes,
            tcp: tcpRes,
            pg: pgRes
        };
    }
    async triggerShotRender(body) {
        if (process.env.GATE_MODE !== '1') {
            throw new common_1.BadRequestException('Endpoint only available in GATE_MODE=1');
        }
        if (!body.shotId)
            throw new common_1.BadRequestException('shotId required');
        if (!body.artifactDir)
            throw new common_1.BadRequestException('artifactDir required');
        const absArtifactDir = this.resolveArtifactDir(body.artifactDir);
        const traceId = body.jobId || `w3_1_${Date.now()}`;
        const shot = await this.db.shot.findUnique({
            where: { id: body.shotId },
            include: {
                scene: {
                    include: {
                        episode: {
                            include: {
                                season: {
                                    include: {
                                        project: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!shot || !shot.scene?.episode?.season?.project) {
            throw new common_1.BadRequestException(`Shot hierarchy incomplete for ${body.shotId}. Ensure Scene, Episode, and Season exist.`);
        }
        const project = shot.scene.episode.season.project;
        const organizationId = project.organizationId;
        const member = await this.db.organizationMember.findFirst({
            where: { organizationId: organizationId },
            select: { userId: true },
        });
        const userId = member?.userId || 'system';
        this.logger.log(`[ProdGate] Enqueueing SHOT_RENDER job via JobService. Shot: ${body.shotId}, Project: ${project.id}, Org: ${organizationId}`);
        const job = await this.jobService.create(body.shotId, {
            type: 'SHOT_RENDER',
            isVerification: true,
            payload: {
                prompt: body.prompt || 'W3-1 Seal Audit',
                seed: body.seed ?? 42,
                artifactDir: absArtifactDir,
                referenceSheetId: 'gate-mock-ref-id',
                traceId,
            },
            traceId,
        }, userId, organizationId);
        return {
            success: true,
            jobId: job.id,
            traceId,
            status: job.status,
            artifactDir: absArtifactDir,
        };
    }
    async getJobStatus(jobId) {
        if (process.env.GATE_MODE !== '1') {
            throw new common_1.BadRequestException('Endpoint only available in GATE_MODE=1');
        }
        const job = await this.db.shotJob.findUnique({
            where: { id: jobId },
        });
        if (!job) {
            throw new common_1.BadRequestException(`Job not found: ${jobId}`);
        }
        if (job.type !== 'SHOT_RENDER' &&
            job.type !== 'CE06_NOVEL_PARSING' &&
            job.type !== 'NOVEL_ANALYSIS') {
        }
        return job;
    }
    async triggerStage1Pipeline(body) {
        if (process.env.GATE_MODE !== '1') {
            throw new common_1.BadRequestException('Endpoint only available in GATE_MODE=1');
        }
        this.logger.log(`[ProdGate] Starting Stage 1 Pipeline for project: ${body.projectId}`);
        const result = await this.orchestratorService.startStage1Pipeline(body);
        return { success: true, data: result };
    }
    async triggerNovelAnalysis(body) {
        if (process.env.GATE_MODE !== '1') {
            throw new common_1.BadRequestException('Endpoint only available in GATE_MODE=1');
        }
        if (!body.projectId)
            throw new common_1.BadRequestException('projectId required');
        if (!body.filePath && !body.rawText)
            throw new common_1.BadRequestException('filePath or rawText required');
        const traceId = body.jobId || `w3_1_na_${Date.now()}`;
        const organizationId = 'default-org';
        this.logger.log(`[ProdGate] Enqueueing NOVEL_ANALYSIS job via createCECoreJob. Project: ${body.projectId}`);
        try {
            const job = await this.jobService.createCECoreJob({
                projectId: body.projectId,
                organizationId,
                jobType: database_1.JobType.NOVEL_ANALYSIS,
                payload: {
                    projectId: body.projectId,
                    filePath: body.filePath,
                    sourceText: body.rawText,
                    traceId,
                },
                traceId,
                isVerification: true,
            });
            return {
                success: true,
                jobId: job.id,
                traceId,
                status: job.status,
            };
        }
        catch (err) {
            this.logger.error(`[ProdGate] Failed to trigger novel-analysis: ${err.message}`, err.stack);
            throw err;
        }
    }
};
exports.ProdGateController = ProdGateController;
__decorate([
    (0, common_1.Get)('network-check'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProdGateController.prototype, "networkCheck", null);
__decorate([
    (0, common_1.Post)('shot-render'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProdGateController.prototype, "triggerShotRender", null);
__decorate([
    (0, common_1.Get)('jobs/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProdGateController.prototype, "getJobStatus", null);
__decorate([
    (0, common_1.Post)('stage1-pipeline'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProdGateController.prototype, "triggerStage1Pipeline", null);
__decorate([
    (0, common_1.Post)('novel-analysis'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProdGateController.prototype, "triggerNovelAnalysis", null);
exports.ProdGateController = ProdGateController = ProdGateController_1 = __decorate([
    (0, common_1.Controller)('admin/prod-gate'),
    __metadata("design:paramtypes", [engine_registry_service_1.EngineRegistry,
        shot_render_router_adapter_1.ShotRenderRouterAdapter,
        orchestrator_service_1.OrchestratorService,
        job_service_1.JobService,
        prisma_service_1.PrismaService])
], ProdGateController);
//# sourceMappingURL=prod-gate.controller.js.map