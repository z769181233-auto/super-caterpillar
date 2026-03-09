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
var QualityScoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityScoreService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("../job/job.service");
const common_2 = require("@nestjs/common");
const identity_consistency_service_1 = require("../identity/identity-consistency.service");
const project_resolver_1 = require("../common/project-resolver");
let QualityScoreService = QualityScoreService_1 = class QualityScoreService {
    prisma;
    jobService;
    identityService;
    projectResolver;
    logger = new common_1.Logger(QualityScoreService_1.name);
    constructor(prisma, jobService, identityService, projectResolver) {
        this.prisma = prisma;
        this.jobService = jobService;
        this.identityService = identityService;
        this.projectResolver = projectResolver;
    }
    async performScoring(shotId, traceId, attempt = 1) {
        console.error(`Performing quality scoring for shot ${shotId}, attempt ${attempt}`);
        const identityScoreRecord = await this.prisma.shotIdentityScore.findFirst({
            where: { shotId },
            orderBy: { createdAt: 'desc' },
        });
        let identityScore = identityScoreRecord?.identityScore || 0;
        let realScoreResult = null;
        let realError = null;
        let ce23RealEnabled = false;
        let ce23RealShadowEnabled = false;
        const shotForSettings = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: { scene: { include: { episode: true } } },
        });
        const projectWithSettings = await this.projectResolver.resolveProjectNeedSettings(shotForSettings?.scene?.episode);
        const settings = projectWithSettings?.settingsJson || {};
        const forceDisable = process.env.CE23_REAL_FORCE_DISABLE === '1';
        if (forceDisable) {
            this.logger.warn(`[P16-2] CE23 Real/Shadow FORCE DISABLED by Env for shot ${shotId}`);
            ce23RealEnabled = false;
            ce23RealShadowEnabled = false;
            realScoreResult = null;
        }
        else {
            ce23RealEnabled = !!settings.ce23RealEnabled;
            ce23RealShadowEnabled = !!settings.ce23RealShadowEnabled;
        }
        if (ce23RealEnabled || ce23RealShadowEnabled) {
            try {
                if (identityScoreRecord?.referenceAnchorId && identityScoreRecord?.targetAssetId) {
                    const anchor = await this.prisma.identityAnchor.findUnique({
                        where: { id: identityScoreRecord.referenceAnchorId },
                    });
                    if (anchor) {
                        realScoreResult = await this.identityService.scoreIdentityReal(anchor.referenceAssetId, identityScoreRecord.targetAssetId, identityScoreRecord.characterId);
                    }
                }
            }
            catch (err) {
                this.logger.error(`[P16] REAL Score Calc Failed: ${err.message}`);
                realError = err.message;
            }
        }
        if (ce23RealEnabled || ce23RealShadowEnabled) {
            try {
                if (identityScoreRecord) {
                    const anchor = await this.prisma.identityAnchor.findUnique({
                        where: { id: identityScoreRecord.referenceAnchorId },
                    });
                    if (anchor) {
                        realScoreResult = await this.identityService.scoreIdentityReal(anchor.referenceAssetId, identityScoreRecord.targetAssetId, identityScoreRecord.characterId);
                    }
                }
                else {
                }
            }
            catch (e) {
                realError = e.message;
            }
        }
        if (ce23RealEnabled && realScoreResult?.verdict) {
            identityScore = realScoreResult.score;
        }
        const renderAsset = await this.prisma.asset.findFirst({
            where: { shotId, type: 'VIDEO' },
        });
        const renderPhysicalPass = !!renderAsset;
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            select: { sceneId: true },
        });
        let audioPass = false;
        if (shot?.sceneId) {
            const audioAssets = await this.prisma.asset.findMany({
                where: {
                    ownerId: shot.sceneId,
                    type: { in: ['AUDIO_TTS', 'AUDIO_BGM'] },
                },
            });
            const hasTTS = audioAssets.some((a) => a.type === 'AUDIO_TTS');
            const hasBGM = audioAssets.some((a) => a.type === 'AUDIO_BGM');
            audioPass = hasTTS && hasBGM;
        }
        const signals = {
            identity_score: identityScore,
            render_physical: renderPhysicalPass ? 1 : 0,
            audio_existence: audioPass ? 1 : 0,
        };
        if (realScoreResult) {
            signals.identity_score_real_ppv64 = realScoreResult.score;
            signals.ce23_provider = 'real-embed-v1';
            signals.ce23_algo_version = 'ppv64_v1';
            signals.ce23_real_mode = ce23RealEnabled ? 'real' : 'shadow';
        }
        if (realError) {
            signals.ce23_real_error = realError;
        }
        if (forceDisable) {
            signals.ce23_kill_switch = true;
            signals.ce23_kill_switch_source = 'env';
            signals.ce23_real_mode = 'legacy';
            delete signals.identity_score_real_ppv64;
            delete signals.ce23_provider;
            delete signals.ce23_algo_version;
            delete signals.ce23_real_error;
        }
        let identityThreshold = 0.8;
        if (ce23RealEnabled) {
            if (typeof settings.ce23RealThreshold === 'number') {
                identityThreshold = settings.ce23RealThreshold;
                signals.ce23_real_threshold_source = 'project_settings';
            }
            else {
                identityThreshold = 0.8;
                signals.ce23_real_threshold_source = 'default_real';
            }
            signals.ce23_real_threshold_used = identityThreshold;
        }
        else {
            identityThreshold = 0.8;
        }
        const isP0Pass = identityScore >= identityThreshold && renderPhysicalPass && audioPass;
        const verdict = isP0Pass ? 'PASS' : 'FAIL';
        const overallScore = (identityScore + (renderPhysicalPass ? 1 : 0) + (audioPass ? 1 : 0)) / 3;
        const ce23RealGuardrailEnabled = !!settings.ce23RealGuardrailEnabled;
        let guardrailBlocked = false;
        let stopReason;
        if (ce23RealEnabled && ce23RealGuardrailEnabled && verdict === 'FAIL' && realScoreResult) {
            const realScore = realScoreResult.score;
            const legacyScore = identityScoreRecord?.identityScore || 0;
            const marginalFloor = identityThreshold - 0.03;
            console.warn(`[GUARDRAIL_DEBUG] Checking shot ${shotId}. Real=${realScore}, Thresh=${identityThreshold} (Floor=${marginalFloor}), Legacy=${legacyScore} (Req >= 0.90)`);
            if (realScore >= marginalFloor && legacyScore >= 0.9) {
                guardrailBlocked = true;
                stopReason = 'GUARDRAIL_BLOCKED_REWORK';
                signals.stopReason = stopReason;
                signals.guardrail_override = true;
                signals.verdict_effective = 'PASS_FOR_PROD';
                console.warn(`[GUARDRAIL] Shot ${shotId} blocked from rework. StopReason set.`);
            }
            else {
                console.warn(`[GUARDRAIL_SKIP] Real=${realScore} vs ${marginalFloor}, Legacy=${legacyScore} vs 0.90. (Enabled: ${ce23RealGuardrailEnabled})`);
            }
        }
        const scoreRecord = await this.prisma.qualityScore.create({
            data: {
                shotId,
                attempt,
                verdict,
                overallScore,
                signals,
            },
        });
        console.error(`Shot ${shotId} verdict: ${verdict}, overallScore: ${overallScore}`);
        try {
            if (verdict === 'FAIL' && !guardrailBlocked) {
                console.error(`[REWORK_DEBUG] Checking rework for shot ${shotId}, attempt ${attempt}`);
                stopReason = await this.handleAutoRework(shotId, traceId, attempt, signals);
                console.error(`[REWORK_DEBUG] Result for shot ${shotId}: stopReason=${stopReason || 'NONE_TRIGGERED'}`);
            }
            if (stopReason) {
                const updatedSignals = {
                    ...signals,
                    stopReason,
                };
                await this.prisma.qualityScore.update({
                    where: { id: scoreRecord.id },
                    data: { signals: updatedSignals },
                });
                console.error(`[REWORK_DEBUG] Updated quality score ${scoreRecord.id} with stopReason: ${stopReason}`);
            }
        }
        catch (err) {
            this.logger.error(`[REWORK_ERROR] handleAutoRework CRASH for shot ${shotId}: ${err.message}`, err.stack);
        }
        return scoreRecord;
    }
    async handleAutoRework(shotId, traceId, attempt, signals) {
        if (attempt >= 2) {
            const reason = 'MAX_ATTEMPT_REACHED';
            console.error(`STOP_REASON=${reason} for shot ${shotId}. Attempt ${attempt} >= 2.`);
            return reason;
        }
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: {
                scene: {
                    include: {
                        episode: true,
                    },
                },
            },
        });
        if (!shot) {
            this.logger.error(`Shot ${shotId} not found, cannot trigger rework.`);
            return 'SHOT_NOT_FOUND';
        }
        const projectId = shot.scene?.episode?.projectId;
        const organizationId = shot.organizationId;
        if (!projectId || !organizationId) {
            this.logger.error(`Missing projectId or organizationId for shot ${shotId}. Rework skipped.`);
            return 'PROJECT_OR_ORG_MISSING';
        }
        const standardizedTraceId = `${traceId}:rework:${attempt + 1}`;
        const reworkKey = `${traceId}:${shotId}:attempt_${attempt + 1}`;
        const reworkConcurrencyCap = parseInt(process.env.REWORK_MAX_CONCURRENCY_PER_ORG || '2', 10);
        const runningReworks = await this.prisma.shotJob.count({
            where: {
                organizationId,
                type: 'SHOT_RENDER',
                status: { in: ['PENDING', 'RUNNING'] },
                isVerification: false,
                traceId: { contains: ':rework:' },
            },
        });
        if (runningReworks >= reworkConcurrencyCap) {
            const reason = 'RATE_LIMIT_BLOCKED';
            console.error(`STOP_REASON=${reason} for shot ${shotId}. Current running reworks: ${runningReworks}, Cap: ${reworkConcurrencyCap}`);
            if (signals) {
                signals.rateLimitSnapshot = { runningReworks, cap: reworkConcurrencyCap };
            }
            return reason;
        }
        try {
            await this.prisma.shotReworkDedupe.create({
                data: {
                    reworkKey,
                    traceId: standardizedTraceId,
                    shotId,
                    attempt: attempt + 1,
                },
            });
        }
        catch (e) {
            if (e.code === 'P2002') {
                const reason = 'IDEMPOTENCY_HIT';
                console.error(`STOP_REASON=${reason} (reworkKey=${reworkKey}) for shot ${shotId}.`);
                return reason;
            }
            throw e;
        }
        console.error(`Triggering rework for shot ${shotId}, new attempt: ${attempt + 1}, traceId: ${standardizedTraceId}`);
        console.error(`[REWORK_DEBUG] Triggering jobService.create for shot ${shotId} orgId ${organizationId} traceId ${standardizedTraceId}`);
        try {
            await this.jobService.create(shotId, {
                type: 'SHOT_RENDER',
                dedupeKey: reworkKey,
                traceId: standardizedTraceId,
                payload: {
                    traceId: standardizedTraceId,
                    attempt: attempt + 1,
                    reworkKey,
                    reason: 'QUALITY_FAIL',
                    signals,
                    referenceSheetId: 'gate-mock-ref-id',
                },
                isVerification: false,
            }, 'system-rework', organizationId);
        }
        catch (e) {
            this.logger.error(`[REWORK_ERROR] handleAutoRework failed for shot ${shotId}: message="${e.message}" code="${e.code}" response=${JSON.stringify(e.response)}`);
            const errorMsg = e.message || '';
            const responseMsg = e.response?.message || '';
            if (errorMsg.includes('Insufficient credits') ||
                responseMsg.includes('Insufficient credits')) {
                const reason = 'BUDGET_GUARD_BLOCKED';
                console.error(`STOP_REASON=${reason} (via catch) for shot ${shotId}.`);
                return reason;
            }
            this.logger.error(`Failed to create rework job for shot ${shotId}: ${e.message}`);
            throw e;
        }
        return undefined;
    }
    buildQualityScoreFromJob(job, adapter, taskId) {
        try {
            const engineKey = this.extractEngineKey(job);
            const adapterName = adapter?.name || engineKey;
            const metrics = this.extractMetrics(job);
            const quality = this.extractQuality(job);
            const modelInfo = this.extractModelInfo(job, adapter);
            return {
                taskId,
                jobId: job.id,
                engineKey,
                adapterName,
                modelInfo,
                metrics,
                quality,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error(`Failed to build quality score from job ${job.id}:`, error);
            return null;
        }
    }
    extractEngineKey(job) {
        if (job?.payload && typeof job.payload === 'object') {
            const payload = job.payload;
            if (payload.engineKey && typeof payload.engineKey === 'string') {
                return payload.engineKey;
            }
        }
        const jobType = job?.type;
        if (jobType === 'NOVEL_ANALYSIS')
            return 'default_novel_analysis';
        if (jobType === 'SHOT_RENDER')
            return 'default_shot_render';
        return 'default_novel_analysis';
    }
    extractMetrics(job) {
        const metrics = {};
        if (job?.payload && typeof job.payload === 'object') {
            const payload = job.payload;
            if (payload.result && typeof payload.result === 'object') {
                const result = payload.result;
                if (result.metrics && typeof result.metrics === 'object') {
                    const resultMetrics = result.metrics;
                    if (typeof resultMetrics.durationMs === 'number')
                        metrics.durationMs = resultMetrics.durationMs;
                    if (typeof resultMetrics.tokens === 'number')
                        metrics.tokens = resultMetrics.tokens;
                    if (typeof resultMetrics.costUsd === 'number')
                        metrics.costUsd = resultMetrics.costUsd;
                }
            }
        }
        return metrics;
    }
    extractQuality(job) {
        const quality = {};
        if (job?.payload && typeof job.payload === 'object') {
            const payload = job.payload;
            if (payload.result && typeof payload.result === 'object') {
                const result = payload.result;
                if (result.quality && typeof result.quality === 'object') {
                    const resultQuality = result.quality;
                    if (typeof resultQuality.confidence === 'number')
                        quality.confidence = resultQuality.confidence;
                    if (typeof resultQuality.score === 'number')
                        quality.score = resultQuality.score;
                }
                else {
                    if (typeof result.confidence === 'number')
                        quality.confidence = result.confidence;
                    if (typeof result.score === 'number')
                        quality.score = result.score;
                }
            }
        }
        return quality;
    }
    extractModelInfo(job, adapter) {
        const modelInfo = {};
        if (job?.payload && typeof job.payload === 'object') {
            const payload = job.payload;
            if (payload.result && typeof payload.result === 'object') {
                const result = payload.result;
                if (result.modelInfo && typeof result.modelInfo === 'object') {
                    const resultModelInfo = result.modelInfo;
                    if (typeof resultModelInfo.modelName === 'string')
                        modelInfo.modelName = resultModelInfo.modelName;
                    if (typeof resultModelInfo.version === 'string')
                        modelInfo.version = resultModelInfo.version;
                }
            }
        }
        if (modelInfo.modelName || modelInfo.version)
            return modelInfo;
        return undefined;
    }
};
exports.QualityScoreService = QualityScoreService;
exports.QualityScoreService = QualityScoreService = QualityScoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_2.Inject)((0, common_2.forwardRef)(() => job_service_1.JobService))),
    __param(3, (0, common_2.Inject)((0, common_2.forwardRef)(() => project_resolver_1.ProjectResolver))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        job_service_1.JobService,
        identity_consistency_service_1.IdentityConsistencyService,
        project_resolver_1.ProjectResolver])
], QualityScoreService);
//# sourceMappingURL=quality-score.service.js.map