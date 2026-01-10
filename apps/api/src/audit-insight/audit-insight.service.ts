import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NovelInsightResponse,
  JobAuditResponse,
  NovelAnalysisArtifact,
  MemoryUpdateArtifact,
  NovelAuditFullResponse,
  AuditJobSummaryDto,
  DirectorAuditSummaryDto,
  DagRunSummaryDto,
} from './audit-insight.dto';
import { DirectorConstraintSolverService } from '../shot-director/director-solver.service';

import { SignedUrlService } from '../storage/signed-url.service';

@Injectable()
export class AuditInsightService {
  private readonly logger = new Logger(AuditInsightService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signedUrlService: SignedUrlService
  ) { }

  async getNovelInsight(novelSourceId: string): Promise<NovelInsightResponse> {
    // 1. Find Project by NovelSource
    const novelSource = await this.prisma.novelSource.findUnique({
      where: { id: novelSourceId },
      include: { project: true },
    });

    if (!novelSource) {
      throw new NotFoundException(`NovelSource ${novelSourceId} not found`);
    }

    const projectId = novelSource.projectId;

    // 2. Fetch CE06: NovelAnalysisJobs (Legacy)
    const ce06LegacyJobs = await this.prisma.novelAnalysisJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Fetch CE06: ShotJobs (New)
    const ce06ShotJobs = await this.prisma.shotJob.findMany({
      where: {
        projectId,
        type: 'CE06_NOVEL_PARSING',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Enrich CE06 Legacy
    const ce06LegacyArtifacts: NovelAnalysisArtifact[] = await Promise.all(
      ce06LegacyJobs.map(async (job) => {
        const auditLog = await this.prisma.auditLog.findFirst({
          where: {
            resourceId: job.id,
            action: { contains: 'SUCCESS' },
          },
          select: { details: true, apiKey: { select: { ownerUserId: true } } },
        });

        const details = (auditLog?.details as Record<string, any>) || {};

        return {
          jobId: job.id,
          workerId: (details['workerId'] as string) || auditLog?.apiKey?.ownerUserId || 'UNKNOWN',
          engineKey: (details['engineKey'] as string) || 'ce06_novel_parsing',
          engineVersion: (details['engineVersion'] as string) || '1.0.0',
          createdAt: job.createdAt,
          status: job.status,
          payload: { novelSourceId: job.novelSourceId },
          result: job.progress,
        };
      })
    );

    // Enrich CE06 ShotJobs
    const ce06NewArtifacts: NovelAnalysisArtifact[] = ce06ShotJobs.map((job) => {
      const payload = (job.payload as Record<string, any>) || {};
      return {
        jobId: job.id,
        workerId: job.workerId || 'UNKNOWN',
        engineKey: 'ce06_novel_parsing',
        engineVersion: '1.0.0',
        createdAt: job.createdAt,
        status: job.status,
        payload: { novelSourceId: payload['novelSourceId'] },
        result: null, // ShotJob might not store progress same way, or fetch from output?
      };
    });

    const ce06Artifacts = [...ce06LegacyArtifacts, ...ce06NewArtifacts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // 3. Fetch CE07: Query AuditLog which HAS projectId
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

    const ce07Artifacts: MemoryUpdateArtifact[] = await Promise.all(
      ce07AuditLogs.map(async (log) => {
        const details = (log.details as Record<string, any>) || {};
        const jobId = log.resourceId;

        if (!jobId) {
          return {
            jobId: 'UNKNOWN',
            workerId: (details['workerId'] as string) || 'UNKNOWN',
            engineKey: (details['engineKey'] as string) || 'ce07_memory_update',
            engineVersion: (details['engineVersion'] as string) || '1.0.0',
            createdAt: log.createdAt,
            status: 'UNKNOWN',
            payload: (log.payload as Record<string, any>) || {},
            latencyMs: (details['latency_ms'] as number) || 0,
          };
        }

        const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });

        return {
          jobId: jobId,
          workerId: (details['workerId'] as string) || 'UNKNOWN',
          engineKey: (details['engineKey'] as string) || 'ce07_memory_update',
          engineVersion: (details['engineVersion'] as string) || '1.0.0',
          createdAt: log.createdAt,
          status: job?.status || 'UNKNOWN',
          payload: job?.payload || {},
          memoryContent: details['output'] || (job as any)?.result || {},
        };
      })
    );

    // 4. Fetch CE03/CE04: Visual Metrics Jobs
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
      const output = ((job as any).result as any) || {};
      let score = 0;
      if (job.type === 'CE03_VISUAL_DENSITY') {
        score = (output['visual_density_score'] as number) || 0;
      } else if (job.type === 'CE04_VISUAL_ENRICHMENT') {
        score = (output['enrichment_quality'] as number) || 0;
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

  async getNovelAuditFull(novelSourceId: string, userId: string): Promise<NovelAuditFullResponse> {
    // 1. Resolve projectId
    const novelSource = await this.prisma.novelSource.findUnique({
      where: { id: novelSourceId },
      include: { project: true },
    });

    if (!novelSource) {
      throw new NotFoundException(`NovelSource ${novelSourceId} not found`);
    }

    const projectId = novelSource.projectId;

    // 2. Fetch Latest Jobs (orderBy createdAt desc take 1)
    const fetchLatestJob = async (type: string) => {
      return this.prisma.shotJob.findFirst({
        where: { projectId, type: type as any }, // ✅ Type cast for safety
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

    const mapJob = (j: any): AuditJobSummaryDto | null =>
      j
        ? {
          jobId: j.id,
          traceId: j.traceId || '',
          status: j.status,
          createdAtIso: j.createdAt.toISOString(),
          workerId: j.workerId || 'UNKNOWN',
        }
        : null;

    // 3. Fetch Metrics (Precise Binding)
    const fetchMetrics = async (jobId?: string, traceId?: string, engine?: string) => {
      if (!jobId || !traceId) return null;
      return this.prisma.qualityMetrics.findFirst({
        where: { projectId, engine, jobId, traceId },
        orderBy: { createdAt: 'desc' },
      });
    };

    const [ce03M, ce04M] = await Promise.all([
      fetchMetrics(ce03J?.id, ce03J?.traceId || undefined, 'CE03'),
      fetchMetrics(ce04J?.id, ce04J?.traceId || undefined, 'CE04'),
    ]);

    // 4. Director (Real-time with Cap and Timeout)
    const PERFORMANCE_CAP = 50;
    const TIMEOUT_MS = 2000;

    const shots = await this.prisma.shot.findMany({
      where: {
        scene: {
          episode: { season: { project: { novelSources: { some: { id: novelSourceId } } } } },
        },
      },
      take: PERFORMANCE_CAP,
      orderBy: { index: 'asc' }, // ✅ Using index since createdAt is missing
    });

    // Director Audit Logging (Production Hardened)
    if (shots.length === 0) {
      this.logger.warn(
        `No shots found for NovelSource ${novelSourceId}. Check Episode->Season->Project relation.`
      );
    } else {
      this.logger.log(
        `Found ${shots.length} shots. First params type: ${typeof shots[0].params}`
      );
    }

    const solver = new DirectorConstraintSolverService();

    // Timeout Protection using Promise.race
    let results: any[] = [];
    let isPartial = false;
    let message = 'Success';

    /* eslint-disable @typescript-eslint/no-explicit-any */
    try {
      results = (await Promise.race([
        Promise.resolve(
          shots.map((s) =>
            solver.validateShot({
              id: s.id,
              type: s.type as any,
              // Ensure params is parsed if it's stored as JSON string, or used as object
              params: typeof s.params === 'string' ? JSON.parse(s.params) : s.params || {},
              // Map other necessary fields like enriched_prompt if available
            })
          )
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)),
      ])) as any[];
    } catch (e: any) {
      isPartial = true;
      message =
        e.message === 'TIMEOUT' ? 'Director evaluation timed out (partial results)' : e.message;
      results = []; // Or keep partial if we had them
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const totalViolations = results.reduce((acc, r) => acc + r.violations.length, 0);
    const totalSuggestions = results.reduce((acc, r) => acc + r.suggestions.length, 0);
    const sampleViolations = results
      .flatMap((r) => r.violations)
      .slice(0, 10)
      .map((v) => ({
        ruleId: v.ruleId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        severity: v.severity as any,
        message: v.message,
      }));

    const director: DirectorAuditSummaryDto & {
      partial?: boolean;
      message?: string;
      evaluatedShots?: number;
    } = {
      mode: 'realtime',
      shotsEvaluated: shots.length,
      evaluatedShots: shots.length, // Alias for backward compatibility
      isValid: results.length > 0 ? results.every((r) => r.isValid) : false, // Default to false if no shots
      violationsCount: totalViolations,
      suggestionsCount: totalSuggestions,
      violationsSample: sampleViolations,
      computedAtIso: new Date().toISOString(),
      partial: isPartial,
      message: message,
    };

    // 5. DAG Timeline (Trace-based)
    const dagTraceId = ce04J?.traceId || ce03J?.traceId || ce06J?.traceId || null;
    let timeline: any[] = [];
    let missingPhases: string[] = [];

    if (dagTraceId) {
      const traceJobs = await this.prisma.shotJob.findMany({
        where: { traceId: dagTraceId, projectId },
        orderBy: { createdAt: 'asc' },
      });

      const findInTrace = (type: string) => traceJobs.find((j) => j.type === type);
      const phases = [
        { type: 'CE06_NOVEL_PARSING', label: 'CE06' },
        { type: 'CE03_VISUAL_DENSITY', label: 'CE03' },
        { type: 'CE04_VISUAL_ENRICHMENT', label: 'CE04' },
        { type: 'SHOT_RENDER', label: 'SHOT' },
        { type: 'VIDEO_RENDER', label: 'VIDEO' },
      ];

      timeline = phases.map((p) => {
        const job = findInTrace(p.type);
        if (!job) missingPhases.push(p.label);
        return {
          phase: p.label,
          jobId: job?.id || 'MISSING',
          status: job?.status || 'MISSING',
        };
      });
    } else {
      missingPhases = ['CE06', 'CE03', 'CE04', 'SHOT', 'VIDEO'];
    }

    // 6. Video Asset Resolution (SSOT: Asset Table)
    let videoAsset:
      | undefined
      | {
        status: string;
        secureUrl?: string;
        jobId?: string;
        assetId?: string;
        storageKey?: string;
      };

    // Step 6A: Resolve shotId (must be derived from reliable context)
    // Prefer explicit shotId from VIDEO_RENDER job payload if present, else from CE04 payload, else latest shot in this project.
    let shotId: string | null =
      ((videoJ?.payload as any)?.shotId as string | undefined) ||
      ((ce04J?.payload as any)?.shotId as string | undefined) ||
      null;

    if (!shotId) {
      const shot = await this.prisma.shot.findFirst({
        where: { scene: { episode: { season: { projectId } } } },
        select: { id: true },
      });
      shotId = shot?.id || null;
    }

    // Step 6B: Query Asset table as SSOT
    let videoFromAsset: {
      id: string;
      storageKey: string | null;
      createdByJobId: string | null;
    } | null = null;

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
      // Use Asset SSOT
      try {
        const { url } = this.signedUrlService.generateSignedUrl({
          key: videoFromAsset.storageKey,
          tenantId: projectId, // tenant binding (project-scoped)
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
      } catch (e) {
        this.logger.error('[AuditInsight] Failed to sign video URL from Asset SSOT', (e as Error).message);
        videoAsset = {
          status: 'ERROR_SIGNING',
          assetId: videoFromAsset.id,
          storageKey: videoFromAsset.storageKey,
          jobId: videoFromAsset.createdByJobId || undefined,
        };
      }
    } else if (videoJ) {
      // DEPRECATED Fallback (job payload result.videoKey)
      this.logger.warn(
        `WARN_DEPRECATED_JOB_VIDEO_KEY_PATH_USED=1 projectId=${projectId}`
      );

      const payload = (videoJ.payload as any) || {};
      const res = payload.result || {};
      const legacyKey = res.videoKey as string | undefined;

      if (videoJ.status === 'SUCCEEDED' && legacyKey) {
        try {
          const { url } = this.signedUrlService.generateSignedUrl({
            key: legacyKey,
            tenantId: projectId,
            userId,
            expiresIn: 3600,
          });
          videoAsset = { status: 'READY', secureUrl: url, jobId: videoJ.id, storageKey: legacyKey };
        } catch (e) {
          this.logger.error('[AuditInsight] Failed to sign video URL from legacy job payload', (e as Error).message);
          videoAsset = { status: 'ERROR_SIGNING', jobId: videoJ.id, storageKey: legacyKey };
        }
      } else {
        videoAsset = { status: videoJ.status, jobId: videoJ.id };
      }
    }

    const dag: DagRunSummaryDto = {
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

  async getJobAudit(jobId: string): Promise<JobAuditResponse> {
    // Try ShotJob first
    let job: any = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
    if (!job) {
      // Try NovelAnalysisJob
      job = await this.prisma.novelAnalysisJob.findUnique({ where: { id: jobId } });
    }

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { resourceId: jobId },
      orderBy: { createdAt: 'asc' },
    });

    const safeWorkerId = (logs: any[]): string | undefined => {
      const log = logs.find((l) => {
        const d = l.details as Record<string, any>;
        return d && d['workerId'];
      });
      if (log) {
        return (log.details as Record<string, any>)['workerId'];
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
}
