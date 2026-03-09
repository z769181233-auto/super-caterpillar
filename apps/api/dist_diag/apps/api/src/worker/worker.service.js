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
var WorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const job_service_1 = require("../job/job.service");
const database_1 = require("database");
const job_rules_1 = require("../job/job.rules");
let WorkerService = WorkerService_1 = class WorkerService {
    prisma;
    auditLogService;
    jobService;
    logger = new common_1.Logger(WorkerService_1.name);
    constructor(prisma, auditLogService, jobService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.jobService = jobService;
    }
    dispatchHistory = new Map();
    CASCADE_LIMIT = 100;
    CASCADE_WINDOW = 10000;
    async registerWorker(workerId, name, capabilities, gpuCount, gpuMemory, gpuType, userId, apiKeyId, ip, userAgent) {
        let worker = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (worker) {
            worker = await this.prisma.workerNode.update({
                where: { workerId },
                data: {
                    status: database_1.WorkerStatus.online,
                    capabilities: capabilities,
                    gpuCount,
                    gpuMemory,
                    gpuType,
                    lastHeartbeat: new Date(),
                },
            });
        }
        else {
            worker = await this.prisma.workerNode.create({
                data: {
                    workerId,
                    status: database_1.WorkerStatus.online,
                    capabilities: capabilities,
                    gpuCount,
                    gpuMemory,
                    gpuType,
                    lastHeartbeat: new Date(),
                },
            });
        }
        await this.auditLogService.record({
            userId,
            apiKeyId,
            action: 'WORKER_REGISTERED',
            resourceType: 'worker',
            resourceId: worker.id,
            ip,
            userAgent,
            details: {
                workerId: worker.workerId,
                name,
                capabilities: worker.capabilities,
                status: worker.status,
            },
        });
        return worker;
    }
    async heartbeat(workerId, status, tasksRunning, temperature, _userId, _apiKeyId, _ip, _userAgent) {
        const worker = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!worker) {
            throw new common_1.NotFoundException(`Worker ${workerId} not found`);
        }
        const now = new Date();
        await this.prisma.workerHeartbeat.upsert({
            where: { workerId },
            create: {
                workerId,
                lastSeenAt: now,
                status: 'ALIVE',
            },
            update: {
                lastSeenAt: now,
            },
        });
        const runningJobCount = await this.prisma.shotJob.count({
            where: {
                workerId: worker.id,
                status: database_1.JobStatus.RUNNING,
            },
        });
        const updateData = {
            lastHeartbeat: now,
        };
        if (status) {
            updateData.status = status;
        }
        else {
            const actualTasksRunning = tasksRunning !== undefined ? tasksRunning : runningJobCount;
            if (actualTasksRunning > 0) {
                updateData.status = database_1.WorkerStatus.busy;
            }
            else {
                if (worker.status === database_1.WorkerStatus.offline) {
                    updateData.status = database_1.WorkerStatus.offline;
                }
                else {
                    updateData.status = database_1.WorkerStatus.idle;
                }
            }
        }
        if (tasksRunning !== undefined) {
            updateData.tasksRunning = tasksRunning;
        }
        else {
            updateData.tasksRunning = runningJobCount;
        }
        if (temperature !== undefined) {
            updateData.temperature = temperature;
        }
        const updatedWorker = await this.prisma.workerNode.update({
            where: { workerId },
            data: updateData,
        });
        return updatedWorker;
    }
    async getOnlineWorkers(jobType) {
        const workers = await this.prisma.workerNode.findMany({
            where: {
                status: {
                    in: [database_1.WorkerStatus.online, database_1.WorkerStatus.idle, database_1.WorkerStatus.busy],
                },
            },
        });
        const enabledWorkers = workers.filter((worker) => {
            const caps = worker.capabilities;
            return caps?.disabled !== true;
        });
        if (jobType) {
            return enabledWorkers.filter((worker) => {
                const caps = worker.capabilities;
                return caps?.supportedJobTypes?.includes(jobType);
            });
        }
        return enabledWorkers;
    }
    async isWorkerOnline(workerId) {
        const worker = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!worker) {
            return false;
        }
        const { env } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const timeoutMs = env.workerHeartbeatTimeoutMs || 30000;
        const timeoutThreshold = new Date(Date.now() - timeoutMs);
        return (worker.lastHeartbeat >= timeoutThreshold &&
            (worker.status === database_1.WorkerStatus.online ||
                worker.status === database_1.WorkerStatus.idle ||
                worker.status === database_1.WorkerStatus.busy));
    }
    async getNextDispatchedJob(workerId) {
        const worker = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!worker) {
            return null;
        }
        const job = await this.prisma.shotJob.findFirst({
            where: {
                workerId: worker.id,
                status: database_1.JobStatus.DISPATCHED,
            },
            include: {
                task: true,
                shot: {
                    include: {
                        scene: {
                            include: {
                                episode: {
                                    include: {
                                        project: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        return job;
    }
    async startJob(jobId, workerId) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: { worker: true },
        });
        if (!job) {
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        }
        if (job.worker?.workerId !== workerId) {
            throw new common_1.BadRequestException(`Job ${jobId} is not assigned to worker ${workerId}`);
        }
        (0, job_rules_1.assertTransition)(job.status, database_1.JobStatus.RUNNING, {
            jobId: job.id,
            workerId,
            errorCode: 'JOB_STARTED',
        });
        const updatedJob = await this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: database_1.JobStatus.RUNNING,
                attempts: job.attempts + 1,
            },
        });
        if (job.worker.status === database_1.WorkerStatus.idle) {
            await this.prisma.workerNode.update({
                where: { id: job.worker.id },
                data: {
                    status: database_1.WorkerStatus.busy,
                    tasksRunning: job.worker.tasksRunning + 1,
                },
            });
        }
        return updatedJob;
    }
    async markOfflineWorkers() {
        const { env: scuEnv } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const { workerOfflineGraceMs } = scuEnv;
        const timeoutThreshold = new Date(Date.now() - workerOfflineGraceMs);
        this.logger.log(`[Recovery] Checking for dead workers... threshold: ${timeoutThreshold.toISOString()}, grace: ${workerOfflineGraceMs}ms`);
        const timedOutHeartbeats = await this.prisma.workerHeartbeat.findMany({
            where: {
                lastSeenAt: {
                    lt: timeoutThreshold,
                },
                status: {
                    not: 'DEAD',
                },
            },
        });
        if (timedOutHeartbeats.length > 0) {
            const idsToMark = timedOutHeartbeats.map((h) => h.workerId);
            this.logger.warn(`[Recovery] Marking ${idsToMark.length} workers as DEAD: ${idsToMark.join(', ')}`);
            await this.prisma.workerHeartbeat.updateMany({
                where: { workerId: { in: idsToMark } },
                data: { status: 'DEAD' },
            });
            await this.prisma.workerNode.updateMany({
                where: { workerId: { in: idsToMark } },
                data: { status: database_1.WorkerStatus.offline },
            });
        }
        const reclaimedCount = await this.reclaimJobsFromDeadWorkers();
        if (reclaimedCount > 0) {
            this.logger.warn(`[WorkerService] Reclaimed ${reclaimedCount} jobs from dead workers (unified).`);
        }
        return reclaimedCount;
    }
    async determineWorkerState(worker) {
        const { env } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const timeoutMs = env.workerHeartbeatTimeoutMs || 30000;
        const timeoutThreshold = new Date(Date.now() - timeoutMs);
        if (worker.lastHeartbeat < timeoutThreshold) {
            return 'dead';
        }
        if (worker.tasksRunning > 0) {
            return 'busy';
        }
        return 'idle';
    }
    async getWorkerMonitorSnapshot() {
        const workers = await this.prisma.workerNode.findMany({
            orderBy: { id: 'asc' },
        });
        const now = Date.now();
        const { env } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const TIMEOUT = env.workerHeartbeatTimeoutMs || 30000;
        const workerIds = workers.map((w) => w.id);
        const runningJobs = await this.prisma.shotJob.findMany({
            where: {
                status: 'RUNNING',
                workerId: { in: workerIds },
            },
            select: {
                id: true,
                workerId: true,
                type: true,
                payload: true,
            },
        });
        const workerJobMap = new Map();
        for (const job of runningJobs) {
            if (job.workerId) {
                workerJobMap.set(job.workerId, job);
            }
        }
        const formatted = await Promise.all(workers.map(async (w) => {
            const currentJob = workerJobMap.get(w.id);
            let currentEngineKey = null;
            if (currentJob) {
                currentEngineKey = this.jobService.extractEngineKeyFromJob(currentJob);
            }
            return {
                id: w.id,
                status: w.status,
                capabilities: w.capabilities,
                isOnline: w.lastHeartbeat ? now - w.lastHeartbeat.getTime() < TIMEOUT : false,
                lastHeartbeat: w.lastHeartbeat?.toISOString() ?? null,
                tasksRunning: w.tasksRunning,
                createdAt: w.createdAt.toISOString(),
                updatedAt: w.updatedAt.toISOString(),
                currentEngineKey,
            };
        }));
        return {
            total: workers.length,
            online: formatted.filter((w) => w.isOnline).length,
            offline: formatted.filter((w) => !w.isOnline).length,
            idle: formatted.filter((w) => w.status === 'idle').length,
            busy: formatted.filter((w) => w.status === 'busy').length,
            workers: formatted,
        };
    }
    async evaluateWorkerHealth(workerId) {
        const { env: scuEnv } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const { workerOfflineGraceMs } = scuEnv;
        const hb = await this.prisma.workerHeartbeat.findUnique({
            where: { workerId },
            select: { lastSeenAt: true },
        });
        if (!hb?.lastSeenAt)
            return { workerId, status: 'DEAD' };
        const diffMs = Date.now() - hb.lastSeenAt.getTime();
        const diffSec = diffMs / 1000;
        const graceSec = workerOfflineGraceMs / 1000;
        if (diffSec > graceSec)
            return { workerId, status: 'DEAD', lastSeenSec: diffSec };
        if (diffSec > graceSec * 0.8)
            return { workerId, status: 'DEGRADED', lastSeenSec: diffSec };
        return { workerId, status: 'HEALTHY', lastSeenSec: diffSec };
    }
    async getDeadWorkerIds() {
        const rows = await this.prisma.workerHeartbeat.findMany({
            where: { status: 'DEAD' },
            select: { workerId: true },
        });
        return rows.map((r) => r.workerId);
    }
    async reclaimJobsFromDeadWorkers() {
        const deadWorkerIds = await this.getDeadWorkerIds();
        if (deadWorkerIds.length === 0)
            return 0;
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const orphaned = await tx.shotJob.findMany({
                where: {
                    status: 'RUNNING',
                    lockedBy: { in: deadWorkerIds },
                    leaseUntil: { lte: now },
                },
                select: { id: true, projectId: true, lockedBy: true },
            });
            if (orphaned.length === 0)
                return 0;
            for (const j of orphaned) {
                if (!j.projectId) {
                    throw new Error(`Cannot reclaim job without projectId: jobId=${j.id}, deadWorkerId=${j.lockedBy}`);
                }
            }
            await tx.shotJob.updateMany({
                where: { id: { in: orphaned.map((j) => j.id) } },
                data: {
                    status: 'PENDING',
                    workerId: null,
                    lockedBy: null,
                    leaseUntil: null,
                    lastError: 'reclaimed: dead worker',
                },
            });
            const projectIds = Array.from(new Set(orphaned.map((j) => j.projectId)));
            const projects = await tx.project.findMany({
                where: { id: { in: projectIds } },
                select: { id: true, organizationId: true },
            });
            const projToOrg = new Map(projects.map((p) => [p.id, p.organizationId]));
            for (const j of orphaned) {
                const org = projToOrg.get(j.projectId);
                if (!org) {
                    throw new Error(`Cannot resolve org for projectId=${j.projectId} when reclaiming jobId=${j.id}`);
                }
            }
            await tx.auditLog.createMany({
                data: orphaned.map((j) => ({
                    action: 'JOB_RECLAIMED_FROM_DEAD_WORKER',
                    resourceType: 'shot_job',
                    resourceId: j.id,
                    orgId: projToOrg.get(j.projectId),
                    details: { deadWorkerId: j.lockedBy, projectId: j.projectId },
                    createdAt: new Date(),
                })),
            });
            this.logger.warn(`Reclaimed ${orphaned.length} jobs from ${deadWorkerIds.length} dead workers`);
            return orphaned.length;
        });
    }
    async dispatchNextJobForWorker(workerId) {
        console.log(`[XXX_DEBUG] WorkerService.dispatchNextJobForWorker called for ${workerId}`);
        try {
            const workerNode = await this.prisma.workerNode.findUnique({
                where: { workerId },
                include: { shotJobs: { where: { status: database_1.JobStatus.RUNNING } } },
            });
            if (!workerNode) {
                this.logger.warn(`[WorkerService] Worker not found for dispatch: ${workerId}`);
                return null;
            }
            const now = Date.now();
            let history = this.dispatchHistory.get(workerId) || [];
            history = history.filter((t) => now - t < this.CASCADE_WINDOW);
            if (history.length >= this.CASCADE_LIMIT) {
                this.logger.warn(`[WorkerService] Worker ${workerId} hit dispatch limit (${history.length}/${this.CASCADE_LIMIT}). Throttling.`);
                return null;
            }
            this.dispatchHistory.set(workerId, history);
            const dispatchedJob = await this.prisma.$transaction(async (tx) => {
                const existingJob = await tx.shotJob.findFirst({
                    where: {
                        workerId: workerNode.id,
                        status: database_1.JobStatus.DISPATCHED,
                    },
                });
                if (existingJob) {
                    this.logger.log(`[WorkerService] Recovering existing job ${existingJob.id} for worker ${workerId}`);
                    return existingJob;
                }
                const capabilities = workerNode.capabilities || {};
                const supportedJobTypes = capabilities.supportedJobTypes || [];
                if (supportedJobTypes.length === 0) {
                    this.logger.warn(`[WorkerService] Worker ${workerId} has no supportedJobTypes defined.`);
                    return null;
                }
                console.log(`[WorkerService] DEBUG: Searching PENDING jobs for ${workerId}. Types: ${supportedJobTypes.join(',')}`);
                const pendingOrgs = await tx.shotJob.groupBy({
                    by: ['organizationId'],
                    where: {
                        status: database_1.JobStatus.PENDING,
                        type: { in: supportedJobTypes },
                    },
                    _count: true,
                });
                if (pendingOrgs.length === 0) {
                    return null;
                }
                const orgIds = pendingOrgs.map((o) => o.organizationId);
                const orgDetails = await tx.organization.findMany({
                    where: { id: { in: orgIds } },
                    select: {
                        id: true,
                        owner: {
                            select: {
                                UserSubscription: {
                                    where: { status: 'ACTIVE' },
                                    select: {
                                        plan: {
                                            select: { priorityWeight: true, burstConcurrencyLimit: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });
                let pool = orgDetails.map((org) => {
                    const plan = org.owner?.UserSubscription?.plan;
                    return {
                        orgId: org.id,
                        pendingCount: pendingOrgs.find((p) => p.organizationId === org.id)?._count || 0,
                        weight: plan?.priorityWeight || 1,
                        maxConc: plan?.burstConcurrencyLimit || 1,
                    };
                });
                let selectedOrgId = null;
                while (pool.length > 0) {
                    const dirtyRunningCounts = await tx.shotJob.groupBy({
                        by: ['organizationId'],
                        where: {
                            organizationId: { in: pool.map((p) => p.orgId) },
                            status: { in: [database_1.JobStatus.DISPATCHED, database_1.JobStatus.RUNNING] },
                        },
                        _count: true,
                    });
                    let totalWeight = 0;
                    for (const c of pool) {
                        const rc = dirtyRunningCounts.find((r) => r.organizationId === c.orgId)?._count || 0;
                        const remaining = Math.max(0, c.maxConc - rc);
                        const effectiveWeight = c.weight * Math.min(c.pendingCount, remaining);
                        c._effectiveWeight = effectiveWeight;
                        totalWeight += effectiveWeight;
                    }
                    if (totalWeight <= 0) {
                        break;
                    }
                    let randomWeight = Math.random() * totalWeight;
                    let candidateId = pool[0].orgId;
                    for (const c of pool) {
                        randomWeight -= c._effectiveWeight;
                        if (randomWeight <= 0) {
                            candidateId = c.orgId;
                            break;
                        }
                    }
                    await tx.$queryRaw `SELECT id FROM "organizations" WHERE id = ${candidateId} FOR UPDATE`;
                    const actualRunning = await tx.shotJob.count({
                        where: {
                            organizationId: candidateId,
                            status: { in: [database_1.JobStatus.DISPATCHED, database_1.JobStatus.RUNNING] },
                        },
                    });
                    const maxConc = pool.find((p) => p.orgId === candidateId)?.maxConc || 1;
                    if (actualRunning < maxConc) {
                        selectedOrgId = candidateId;
                        break;
                    }
                    else {
                        pool = pool.filter((p) => p.orgId !== candidateId);
                    }
                }
                if (!selectedOrgId) {
                    return null;
                }
                const candidate = await tx.shotJob.findFirst({
                    where: {
                        organizationId: selectedOrgId,
                        status: database_1.JobStatus.PENDING,
                        type: { in: supportedJobTypes },
                    },
                    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
                    take: 1,
                });
                if (!candidate) {
                    console.log(`[WorkerService] DEBUG: No candidate job found for ${workerId}`);
                    return null;
                }
                console.log(`[WorkerService] DEBUG: Found candidate job ${candidate.id} (${candidate.type}). Atomic update via WRR.`);
                const updateResult = await tx.shotJob.updateMany({
                    where: {
                        id: candidate.id,
                        status: database_1.JobStatus.PENDING,
                    },
                    data: {
                        status: database_1.JobStatus.DISPATCHED,
                        workerId: workerNode.id,
                    },
                });
                console.log(`[WorkerService] DEBUG: Atomic update result count: ${updateResult.count}`);
                if (updateResult.count === 0) {
                    return null;
                }
                try {
                    await tx.billingLedger.create({
                        data: {
                            jobId: candidate.id,
                            projectId: candidate.projectId,
                            billingState: 'RESERVED',
                            amount: 1n,
                            idempotencyKey: `${candidate.id}_RESERVED`,
                        },
                    });
                }
                catch (e) {
                    if (e.code === 'P2002') {
                        this.logger.warn(`[WorkerService] Billing idempotency hit: ${candidate.id}_RESERVED already exists`);
                    }
                    else {
                        throw e;
                    }
                }
                const jobWithBinding = await tx.shotJob.findUnique({
                    where: { id: candidate.id },
                    include: { engineBinding: { include: { engine: true } } },
                });
                const { PRODUCTION_MODE: isProd } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
                if (isProd) {
                    const binding = jobWithBinding?.engineBinding;
                    if (!binding) {
                        this.logger.error(`[P1-GATE] Dispatch blocked for Job ${jobWithBinding?.id}: Missing EngineBinding in PRODUCTION.`);
                        await tx.shotJob.update({
                            where: { id: jobWithBinding?.id },
                            data: {
                                status: database_1.JobStatus.FAILED,
                                lastError: `PRODUCTION_MODE_DISPATCH_BLOCK: Missing EngineBinding. Illegal DB injection detected.`,
                            },
                        });
                        return null;
                    }
                    const engine = binding.engine;
                    const engineKey = binding.engineKey;
                    const isStub = !engine || engine.mode !== 'http';
                    const isDefault = engineKey.startsWith('default_') || (engine && engine.code.startsWith('default_'));
                    if (isStub || isDefault) {
                        this.logger.error(`[P1-GATE] Dispatch blocked for Job ${jobWithBinding.id}: Engine ${engineKey} is not allowed in production.`);
                        await tx.shotJob.update({
                            where: { id: jobWithBinding.id },
                            data: {
                                status: database_1.JobStatus.FAILED,
                                lastError: `PRODUCTION_MODE_DISPATCH_BLOCK: Engine ${engineKey} is stub/mock/default`,
                            },
                        });
                        return null;
                    }
                }
                return jobWithBinding;
            });
            if (!dispatchedJob) {
                return null;
            }
            const currentHistory = this.dispatchHistory.get(workerId) || [];
            currentHistory.push(Date.now());
            this.dispatchHistory.set(workerId, currentHistory);
            this.logger.log(JSON.stringify({
                event: 'JOB_CLAIMED',
                jobId: dispatchedJob.id,
                workerId,
                workerNodeId: workerNode.id,
                jobType: dispatchedJob.type,
                taskId: dispatchedJob.taskId || null,
                status: 'DISPATCHED',
                timestamp: new Date().toISOString(),
            }));
            await this.auditLogService.record({
                action: 'JOB_DISPATCHED',
                resourceType: 'job',
                resourceId: dispatchedJob.id,
                details: {
                    workerId,
                    nodeId: workerNode.id,
                    jobType: dispatchedJob.type,
                    taskId: dispatchedJob.taskId,
                },
            });
            return dispatchedJob;
        }
        catch (error) {
            this.logger.error(`[WorkerService] dispatchNextJobForWorker CRITICAL ERROR: ${error}`, error?.stack);
            throw error;
        }
    }
};
exports.WorkerService = WorkerService;
exports.WorkerService = WorkerService = WorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => job_service_1.JobService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        job_service_1.JobService])
], WorkerService);
//# sourceMappingURL=worker.service.js.map