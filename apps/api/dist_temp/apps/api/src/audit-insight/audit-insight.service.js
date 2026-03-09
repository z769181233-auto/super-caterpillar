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
var AuditInsightService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInsightService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const director_solver_service_1 = require("../shot-director/director-solver.service");
const signed_url_service_1 = require("../storage/signed-url.service");
let AuditInsightService = AuditInsightService_1 = class AuditInsightService {
    prisma;
    signedUrlService;
    logger = new common_1.Logger(AuditInsightService_1.name);
    constructor(prisma, signedUrlService) {
        this.prisma = prisma;
        this.signedUrlService = signedUrlService;
    }
    async getNovelInsight(novelSourceId) {
        const novelSource = await this.prisma.novel.findUnique({
            where: { id: novelSourceId },
            include: { project: true },
        });
        if (!novelSource) {
            throw new common_1.NotFoundException(`Novel ${novelSourceId} not found`);
        }
        const projectId = novelSource.projectId;
        const ce06LegacyJobs = await this.prisma.novelAnalysisJob.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const ce06ShotJobs = await this.prisma.shotJob.findMany({
            where: {
                projectId,
                type: 'CE06_NOVEL_PARSING',
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const ce06LegacyArtifacts = await Promise.all(ce06LegacyJobs.map(async (job) => {
            const auditLog = await this.prisma.auditLog.findFirst({
                where: {
                    resourceId: job.id,
                    action: { contains: 'SUCCESS' },
                },
                select: { details: true, apiKey: { select: { ownerUserId: true } } },
            });
            const details = auditLog?.details || {};
            return {
                jobId: job.id,
                workerId: details['workerId'] || auditLog?.apiKey?.ownerUserId || 'UNKNOWN',
                engineKey: details['engineKey'] || 'ce06_novel_parsing',
                engineVersion: details['engineVersion'] || '1.0.0',
                createdAt: job.createdAt,
                status: job.status,
                payload: { novelSourceId: job.novelSourceId },
                result: job.progress,
            };
        }));
        const ce06NewArtifacts = ce06ShotJobs.map((job) => {
            const payload = job.payload || {};
            return {
                jobId: job.id,
                workerId: job.workerId || 'UNKNOWN',
                engineKey: 'ce06_novel_parsing',
                engineVersion: '1.0.0',
                createdAt: job.createdAt,
                status: job.status,
                payload: { novelSourceId: payload['novelSourceId'] },
                result: null,
            };
        });
        const ce06Artifacts = [...ce06LegacyArtifacts, ...ce06NewArtifacts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const ce07AuditLogs = await this.prisma.auditLog.findMany({
            where: {
                resourceType: 'job',
                details: {
                    path: ['projectId'],
                    equals: projectId,
                },
                action: { contains: 'CE07' },
                resourceId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const ce07Artifacts = await Promise.all(ce07AuditLogs.map(async (log) => {
            const details = log.details || {};
            const jobId = log.resourceId;
            if (!jobId) {
                return {
                    jobId: 'UNKNOWN',
                    workerId: details['workerId'] || 'UNKNOWN',
                    engineKey: details['engineKey'] || 'ce07_memory_update',
                    engineVersion: details['engineVersion'] || '1.0.0',
                    createdAt: log.createdAt,
                    status: 'UNKNOWN',
                    payload: log.payload || {},
                    latencyMs: details['latency_ms'] || 0,
                };
            }
            const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
            return {
                jobId: jobId,
                workerId: details['workerId'] || 'UNKNOWN',
                engineKey: details['engineKey'] || 'ce07_memory_update',
                engineVersion: details['engineVersion'] || '1.0.0',
                createdAt: log.createdAt,
                status: job?.status || 'UNKNOWN',
                payload: job?.payload || {},
                memoryContent: details['output'] || job?.result || {},
            };
        }));
        const visualJobs = await this.prisma.shotJob.findMany({
            where: {
                projectId,
                type: {
                    in: ['CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT'],
                },
                status: 'SUCCEEDED',
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const visualMetricArtifacts = visualJobs.map((job) => {
            const output = job.result || {};
            let score = 0;
            if (job.type === 'CE03_VISUAL_DENSITY') {
                score = output['visual_density_score'] || 0;
            }
            else if (job.type === 'CE04_VISUAL_ENRICHMENT') {
                score = output['enrichment_quality'] || 0;
            }
            return {
                jobId: job.id,
                type: job.type,
                status: job.status,
                score,
                output_summary: output,
                created_at: job.createdAt,
            };
        });
        return {
            novelSourceId,
            projectId,
            ce06: ce06Artifacts,
            ce07: ce07Artifacts,
            ce03_04: visualMetricArtifacts,
        };
    }
    async getNovelAuditFull(novelSourceId, userId) {
        const novelSource = await this.prisma.novel.findUnique({
            where: { id: novelSourceId },
            include: { project: true },
        });
        if (!novelSource) {
            throw new common_1.NotFoundException(`Novel ${novelSourceId} not found`);
        }
        const projectId = novelSource.projectId;
        const fetchLatestJob = async (type) => {
            return this.prisma.shotJob.findFirst({
                where: { projectId, type: type },
                orderBy: { createdAt: 'desc' },
            });
        };
        const [ce06J, ce07J, ce03J, ce04J, videoJ] = await Promise.all([
            fetchLatestJob('CE06_NOVEL_PARSING'),
            fetchLatestJob('CE07_MEMORY_UPDATE'),
            fetchLatestJob('CE03_VISUAL_DENSITY'),
            fetchLatestJob('CE04_VISUAL_ENRICHMENT'),
            fetchLatestJob('VIDEO_RENDER'),
        ]);
        const mapJob = (j) => j
            ? {
                jobId: j.id,
                traceId: j.traceId || '',
                status: j.status,
                createdAtIso: j.createdAt.toISOString(),
                workerId: j.workerId || 'UNKNOWN',
            }
            : null;
        const fetchMetrics = async (jobId, traceId, engine) => {
            if (!jobId || !traceId)
                return null;
            return this.prisma.qualityMetrics.findFirst({
                where: { projectId, engine, jobId, traceId },
                orderBy: { createdAt: 'desc' },
            });
        };
        const [ce03M, ce04M] = await Promise.all([
            fetchMetrics(ce03J?.id, ce03J?.traceId || undefined, 'CE03'),
            fetchMetrics(ce04J?.id, ce04J?.traceId || undefined, 'CE04'),
        ]);
        const PERFORMANCE_CAP = 50;
        const TIMEOUT_MS = 2000;
        const shots = await this.prisma.shot.findMany({
            where: {
                scene: {
                    episode: { season: { project: { novelSources: { id: novelSourceId } } } },
                },
            },
            take: PERFORMANCE_CAP,
            orderBy: { index: 'asc' },
        });
        if (shots.length === 0) {
            this.logger.warn(`No shots found for Novel ${novelSourceId}. Check Episode->Season->Project relation.`);
        }
        else {
            this.logger.log(`Found ${shots.length} shots. First params type: ${typeof shots[0].params}`);
        }
        const solver = new director_solver_service_1.DirectorConstraintSolverService();
        let results = [];
        let isPartial = false;
        let message = 'Success';
        try {
            results = (await Promise.race([
                Promise.resolve(shots.map((s) => solver.validateShot({
                    id: s.id,
                    type: s.type,
                    params: typeof s.params === 'string' ? JSON.parse(s.params) : s.params || {},
                }))),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)),
            ]));
        }
        catch (e) {
            isPartial = true;
            message =
                e.message === 'TIMEOUT' ? 'Director evaluation timed out (partial results)' : e.message;
            results = [];
        }
        const totalViolations = results.reduce((acc, r) => acc + r.violations.length, 0);
        const totalSuggestions = results.reduce((acc, r) => acc + r.suggestions.length, 0);
        const sampleViolations = results
            .flatMap((r) => r.violations)
            .slice(0, 10)
            .map((v) => ({
            ruleId: v.ruleId,
            severity: v.severity,
            message: v.message,
        }));
        const director = {
            mode: 'realtime',
            shotsEvaluated: shots.length,
            evaluatedShots: shots.length,
            isValid: results.length > 0 ? results.every((r) => r.isValid) : false,
            violationsCount: totalViolations,
            suggestionsCount: totalSuggestions,
            violationsSample: sampleViolations,
            computedAtIso: new Date().toISOString(),
            partial: isPartial,
            message: message,
        };
        const dagTraceId = ce04J?.traceId || ce03J?.traceId || ce06J?.traceId || null;
        let timeline = [];
        let missingPhases = [];
        if (dagTraceId) {
            const traceJobs = await this.prisma.shotJob.findMany({
                where: { traceId: dagTraceId, projectId },
                orderBy: { createdAt: 'asc' },
            });
            const findInTrace = (type) => traceJobs.find((j) => j.type === type);
            const phases = [
                { type: 'CE06_NOVEL_PARSING', label: 'CE06' },
                { type: 'CE03_VISUAL_DENSITY', label: 'CE03' },
                { type: 'CE04_VISUAL_ENRICHMENT', label: 'CE04' },
                { type: 'SHOT_RENDER', label: 'SHOT' },
                { type: 'VIDEO_RENDER', label: 'VIDEO' },
            ];
            timeline = phases.map((p) => {
                const job = findInTrace(p.type);
                if (!job)
                    missingPhases.push(p.label);
                return {
                    phase: p.label,
                    jobId: job?.id || 'MISSING',
                    status: job?.status || 'MISSING',
                };
            });
        }
        else {
            missingPhases = ['CE06', 'CE03', 'CE04', 'SHOT', 'VIDEO'];
        }
        let videoAsset;
        let shotId = videoJ?.payload?.shotId ||
            ce04J?.payload?.shotId ||
            null;
        if (!shotId) {
            const shot = await this.prisma.shot.findFirst({
                where: { scene: { episode: { season: { projectId } } } },
                select: { id: true },
            });
            shotId = shot?.id || null;
        }
        let videoFromAsset = null;
        if (shotId) {
            videoFromAsset = await this.prisma.asset.findFirst({
                where: {
                    projectId,
                    ownerType: 'SHOT',
                    ownerId: shotId,
                    type: 'VIDEO',
                    status: 'GENERATED',
                },
                orderBy: { createdAt: 'desc' },
                select: { id: true, storageKey: true, createdByJobId: true },
            });
        }
        if (videoFromAsset?.storageKey) {
            try {
                const { url } = this.signedUrlService.generateSignedUrl({
                    key: videoFromAsset.storageKey,
                    tenantId: projectId,
                    userId,
                    expiresIn: 3600,
                });
                videoAsset = {
                    status: 'READY',
                    secureUrl: url,
                    assetId: videoFromAsset.id,
                    storageKey: videoFromAsset.storageKey,
                    jobId: videoFromAsset.createdByJobId || undefined,
                };
            }
            catch (e) {
                this.logger.error('[AuditInsight] Failed to sign video URL from Asset SSOT', e.message);
                videoAsset = {
                    status: 'ERROR_SIGNING',
                    assetId: videoFromAsset.id,
                    storageKey: videoFromAsset.storageKey,
                    jobId: videoFromAsset.createdByJobId || undefined,
                };
            }
        }
        else if (videoJ) {
            this.logger.warn(`WARN_DEPRECATED_JOB_VIDEO_KEY_PATH_USED=1 projectId=${projectId}`);
            const payload = videoJ.payload || {};
            const res = payload.result || {};
            const legacyKey = res.videoKey;
            if (videoJ.status === 'SUCCEEDED' && legacyKey) {
                try {
                    const { url } = this.signedUrlService.generateSignedUrl({
                        key: legacyKey,
                        tenantId: projectId,
                        userId,
                        expiresIn: 3600,
                    });
                    videoAsset = { status: 'READY', secureUrl: url, jobId: videoJ.id, storageKey: legacyKey };
                }
                catch (e) {
                    this.logger.error('[AuditInsight] Failed to sign video URL from legacy job payload', e.message);
                    videoAsset = { status: 'ERROR_SIGNING', jobId: videoJ.id, storageKey: legacyKey };
                }
            }
            else {
                videoAsset = { status: videoJ.status, jobId: videoJ.id };
            }
        }
        const dag = {
            traceId: dagTraceId || 'NONE',
            timeline,
            missingPhases,
            builtFrom: ce04J ? 'latest_ce04_trace' : ce03J ? 'latest_run' : 'empty',
            builtAtIso: new Date().toISOString(),
        };
        return {
            novelSourceId,
            projectId,
            latestJobs: {
                ce06: mapJob(ce06J),
                ce07: mapJob(ce07J),
                ce03: mapJob(ce03J),
                ce04: mapJob(ce04J),
                video: mapJob(videoJ),
            },
            metrics: {
                ce03Score: ce03M?.visualDensityScore || 0,
                ce04Score: ce04M?.enrichmentQuality || 0,
            },
            director,
            dag,
            videoAsset,
        };
    }
    async getJobAudit(jobId) {
        let job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
        if (!job) {
            job = await this.prisma.novelAnalysisJob.findUnique({ where: { id: jobId } });
        }
        if (!job) {
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        }
        const auditLogs = await this.prisma.auditLog.findMany({
            where: { resourceId: jobId },
            orderBy: { createdAt: 'asc' },
        });
        const safeWorkerId = (logs) => {
            const log = logs.find((l) => {
                const d = l.details;
                return d && d['workerId'];
            });
            if (log) {
                return log.details['workerId'];
            }
            return undefined;
        };
        return {
            jobId: job.id,
            type: job.type || job.jobType,
            status: job.status,
            workerId: job.workerId || safeWorkerId(auditLogs) || 'UNKNOWN',
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            payload: job.payload || {},
            result: job.result || job.progress || {},
            auditLogs,
        };
    }
};
exports.AuditInsightService = AuditInsightService;
exports.AuditInsightService = AuditInsightService = AuditInsightService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        signed_url_service_1.SignedUrlService])
], AuditInsightService);
//# sourceMappingURL=audit-insight.service.js.map