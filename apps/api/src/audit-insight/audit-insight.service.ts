
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NovelInsightResponse, JobAuditResponse, NovelAnalysisArtifact, MemoryUpdateArtifact } from './audit-insight.dto';

@Injectable()
export class AuditInsightService {
    constructor(private readonly prisma: PrismaService) { }

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
                type: 'CE06_NOVEL_PARSING'
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // Enrich CE06 Legacy
        const ce06LegacyArtifacts: NovelAnalysisArtifact[] = await Promise.all(ce06LegacyJobs.map(async (job) => {
            const auditLog = await this.prisma.auditLog.findFirst({
                where: {
                    resourceId: job.id,
                    action: { contains: 'SUCCESS' }
                },
                select: { details: true, apiKey: { select: { ownerUserId: true } } }
            });

            const details = (auditLog?.details as Record<string, any>) || {};

            return {
                jobId: job.id,
                workerId: (details['workerId'] as string) || (auditLog?.apiKey?.ownerUserId) || 'UNKNOWN',
                engineKey: (details['engineKey'] as string) || 'ce06_novel_parsing',
                engineVersion: (details['engineVersion'] as string) || '1.0.0',
                createdAt: job.createdAt,
                status: job.status,
                payload: { novelSourceId: job.novelSourceId },
                result: job.progress,
            };
        }));

        // Enrich CE06 ShotJobs
        const ce06NewArtifacts: NovelAnalysisArtifact[] = ce06ShotJobs.map(job => {
            const payload = (job.payload as Record<string, any>) || {};
            return {
                jobId: job.id,
                workerId: job.workerId || 'UNKNOWN',
                engineKey: 'ce06_novel_parsing',
                engineVersion: '1.0.0',
                createdAt: job.createdAt,
                status: job.status,
                payload: { novelSourceId: payload['novelSourceId'] },
                result: null // ShotJob might not store progress same way, or fetch from output?
            };
        });

        const ce06Artifacts = [...ce06LegacyArtifacts, ...ce06NewArtifacts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // 3. Fetch CE07: Query AuditLog which HAS projectId
        const ce07AuditLogs = await this.prisma.auditLog.findMany({
            where: {
                resourceType: 'job',
                details: {
                    path: ['projectId'],
                    equals: projectId
                },
                action: { contains: 'CE07' },
                resourceId: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const ce07Artifacts: MemoryUpdateArtifact[] = await Promise.all(ce07AuditLogs.map(async (log) => {
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
                    latencyMs: (details['latency_ms'] as number) || 0
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
        }));


        return {
            novelSourceId,
            projectId,
            ce06: ce06Artifacts,
            ce07: ce07Artifacts,
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
            orderBy: { createdAt: 'asc' }
        });

        const safeWorkerId = (logs: any[]): string | undefined => {
            const log = logs.find(l => {
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
            auditLogs
        };
    }
}
