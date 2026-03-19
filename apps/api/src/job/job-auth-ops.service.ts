import { Injectable, Inject, NotFoundException, ForbiddenException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolver } from '../common/project-resolver';
import { SHOT_WITH_HIERARCHY } from './job.service.queries';
import { getRuntimeDbTimeoutMs, withRuntimePgClient } from '../prisma/pg-runtime.util';

@Injectable()
export class JobAuthOpsService {
    private readonly prismaQueryTimeoutMs = getRuntimeDbTimeoutMs('query');

    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(forwardRef(() => ProjectResolver))
        private readonly projectResolver: ProjectResolver
    ) { }

    private isPrismaTimeout(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error ?? '');
        return message.includes('PRISMA_QUERY_TIMEOUT');
    }

    private isCiOrGateContext(): boolean {
        return (
            process.env.NODE_ENV === 'test' ||
            process.env.CI === '1' ||
            !!process.env.JEST_WORKER_ID ||
            process.env.GATE_ENV_MODE === 'ci'
        );
    }

    private shouldAllowJobAuthPgFallback(): boolean {
        return this.isCiOrGateContext() || process.env.FORCE_JOB_AUTH_PG_FALLBACK === '1';
    }

    private async withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
        return withRuntimePgClient(
            {
                applicationName: 'super-caterpillar-api-job-auth',
                queryTimeoutMs: this.prismaQueryTimeoutMs,
            },
            fn
        );
    }

    /**
     * Localized Check Shot Ownership (Extracted from JobService)
     */
    async checkShotOwnership(shotId: string, organizationId: string) {
        let shot: any;
        try {
            shot = await this.prisma.shot.findUnique({
                where: { id: shotId },
                include: SHOT_WITH_HIERARCHY,
            });
        } catch (error) {
            if (!this.isPrismaTimeout(error)) {
                throw error;
            }
            if (!this.shouldAllowJobAuthPgFallback()) {
                throw error;
            }

            shot = await this.withPgClient(async (client) => {
                const result = await client.query(
                    `
                      SELECT
                        s.id AS shot_id,
                        s."sceneId" AS scene_id,
                        s."organizationId" AS shot_org_id,
                        sc."episodeId" AS episode_id,
                        sc.project_id AS scene_project_id,
                        p.id AS project_id,
                        p."organizationId" AS project_org_id,
                        p."ownerId" AS project_owner_id
                      FROM public.shots s
                      LEFT JOIN public.scenes sc
                        ON sc.id = s."sceneId"
                      LEFT JOIN public.episodes e
                        ON e.id = sc."episodeId"
                      LEFT JOIN public.projects p
                        ON p.id = COALESCE(e."projectId", sc.project_id)
                      WHERE s.id = $1
                      LIMIT 1
                    `,
                    [shotId]
                );

                const row = result.rows[0] as
                    | {
                        shot_id: string;
                        scene_id: string | null;
                        shot_org_id: string | null;
                        episode_id: string | null;
                        scene_project_id: string | null;
                        project_id: string | null;
                        project_org_id: string | null;
                        project_owner_id: string | null;
                    }
                    | undefined;

                if (!row) return null;

                return {
                    id: row.shot_id,
                    organizationId: row.shot_org_id,
                    scene: row.scene_id
                        ? {
                            id: row.scene_id,
                            projectId: row.scene_project_id,
                            episode: row.episode_id
                                ? {
                                    id: row.episode_id,
                                    projectId: row.project_id ?? row.scene_project_id,
                                    season: row.project_id && row.project_org_id && row.project_owner_id
                                        ? {
                                            project: {
                                                id: row.project_id,
                                                organizationId: row.project_org_id,
                                                ownerId: row.project_owner_id,
                                            },
                                        }
                                        : null,
                                }
                                : null,
                        }
                        : null,
                };
            });
        }

        if (!shot) {
            throw new NotFoundException('Shot not found');
        }

        const scene = shot.scene;
        let shotProject = await this.projectResolver.resolveProjectAuthOnly(scene?.episode);

        // V3.0 Fallback
        if (!shotProject && scene?.projectId) {
            try {
                shotProject = await this.prisma.project.findUnique({
                    where: { id: scene.projectId },
                });
            } catch (error) {
                if (!this.isPrismaTimeout(error) || !this.shouldAllowJobAuthPgFallback()) {
                    throw error;
                }
                shotProject = await this.withPgClient(async (client) => {
                    const result = await client.query(
                        `SELECT id, "organizationId", "ownerId" FROM projects WHERE id = $1 LIMIT 1`,
                        [scene.projectId]
                    );
                    return result.rows[0] || null;
                });
            }
        }

        if (!shotProject) {
            throw new NotFoundException(`Project not found for shot ${shotId}`);
        }

        if (shotProject.organizationId !== organizationId) {
            throw new ForbiddenException('You do not have permission to access this shot');
        }

        return shot;
    }
}
