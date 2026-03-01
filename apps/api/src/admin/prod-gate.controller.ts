import { Controller, Post, Body, Get, Param, Logger, BadRequestException } from '@nestjs/common';
import { EngineRegistry } from '../engine/engine-registry.service';
import { ShotRenderRouterAdapter } from './../engines/adapters/shot_render_router.adapter';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobType } from 'database';
import * as path from 'node:path';

/**
 * Prod Gate Controller (Phase 0-R)
 *
 * Only active when GATE_MODE=1.
 * Provides controlled entry points for automated gate scripts.
 */
@Controller('admin/prod-gate')
export class ProdGateController {
  private readonly logger = new Logger(ProdGateController.name);

  constructor(
    private readonly registry: EngineRegistry,
    private readonly shotRouter: ShotRenderRouterAdapter,
    private readonly orchestratorService: OrchestratorService,
    private readonly jobService: JobService,
    private readonly db: PrismaService
  ) {}

  /**
   * Assert artifactDir is within allowed evidence directory
   */
  private resolveArtifactDir(artifactDir: string): string {
    let repoRoot = process.env.SCU_REPO_ROOT || process.cwd();
    // Monorepo heuristic: if cwd is apps/api, the real root is 2 levels up
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
      throw new BadRequestException(
        `artifactDir out of allowed base: ${abs} (Base: ${allowedBase})`
      );
    }
    return abs;
  }

  /**
   * Trigger a shot render job (creates job in queue for Worker)
   * W3-1 Permanent Fix: Creates standard Job instead of sync rendering
   */
  @Post('shot-render')
  async triggerShotRender(
    @Body()
    body: {
      shotId: string;
      artifactDir: string;
      prompt?: string;
      seed?: number;
      jobId?: string;
    }
  ) {
    if (process.env.GATE_MODE !== '1') {
      throw new BadRequestException('Endpoint only available in GATE_MODE=1');
    }

    if (!body.shotId) throw new BadRequestException('shotId required');
    if (!body.artifactDir) throw new BadRequestException('artifactDir required');

    const absArtifactDir = this.resolveArtifactDir(body.artifactDir);
    const traceId = body.jobId || `w3_1_${Date.now()}`;

    // Lookup real hierarchy to satisfy JobService.create requirements
    // Note: Shot -> Scene -> Episode -> Season -> Project -> Organization
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
      throw new BadRequestException(
        `Shot hierarchy incomplete for ${body.shotId}. Ensure Scene, Episode, and Season exist.`
      );
    }

    const project = shot.scene.episode.season.project;
    const organizationId = project.organizationId;

    // Find a valid user in this organization to satisfy ownership/billing checks in JobService
    const member = await this.db.organizationMember.findFirst({
      where: { organizationId: organizationId },
      select: { userId: true },
    });

    const userId = member?.userId || 'system';

    this.logger.log(
      `[ProdGate] Enqueueing SHOT_RENDER job via JobService. Shot: ${body.shotId}, Project: ${project.id}, Org: ${organizationId}`
    );

    // Create standard Job using JobService.create()
    // Signature: create(shotId, createJobDto, userId, organizationId, taskId?)
    const job = await this.jobService.create(
      body.shotId,
      {
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
      },
      userId,
      organizationId
    );

    return {
      success: true,
      jobId: job.id,
      traceId,
      status: job.status,
      artifactDir: absArtifactDir,
    };
  }

  /**
   * Get job status (for polling)
   */
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    if (process.env.GATE_MODE !== '1') {
      throw new BadRequestException('Endpoint only available in GATE_MODE=1');
    }

    // CONCEPTUAL NOTE: The user requested 'prisma.job', but in our schema it's 'shotJob'.
    const job = await this.db.shotJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException(`Job not found: ${jobId}`);
    }

    /**
     * Relaxed check: Allow both SHOT_RENDER and CE06_NOVEL_PARSING for status checks
     */
    if (
      job.type !== 'SHOT_RENDER' &&
      job.type !== 'CE06_NOVEL_PARSING' &&
      job.type !== 'NOVEL_ANALYSIS'
    ) {
      // Log warning but proceed? Or strict check?
    }

    return job;
  }

  /**
   * Trigger Stage 1 Novel-to-Video Pipeline
   */
  @Post('stage1-pipeline')
  async triggerStage1Pipeline(
    @Body() body: { novelText: string; projectId?: string; organizationId?: string }
  ) {
    if (process.env.GATE_MODE !== '1') {
      throw new BadRequestException('Endpoint only available in GATE_MODE=1');
    }
    this.logger.log(`[ProdGate] Starting Stage 1 Pipeline for project: ${body.projectId}`);
    const result = await this.orchestratorService.startStage1Pipeline(body);
    return { success: true, data: result };
  }

  /**
   * Trigger Novel Analysis (Stream Support)
   */
  @Post('novel-analysis')
  async triggerNovelAnalysis(
    @Body() body: { projectId: string; filePath?: string; rawText?: string; jobId?: string }
  ) {
    if (process.env.GATE_MODE !== '1') {
      throw new BadRequestException('Endpoint only available in GATE_MODE=1');
    }

    if (!body.projectId) throw new BadRequestException('projectId required');
    if (!body.filePath && !body.rawText)
      throw new BadRequestException('filePath or rawText required');

    const traceId = body.jobId || `w3_1_na_${Date.now()}`;
    const organizationId = 'default-org'; // Simplify for gate test

    this.logger.log(
      `[ProdGate] Enqueueing NOVEL_ANALYSIS job via createCECoreJob. Project: ${body.projectId}`
    );

    try {
      // Use createCECoreJob which is cleaner and supports arbitrary job types
      const job = await this.jobService.createCECoreJob({
        projectId: body.projectId,
        organizationId,
        jobType: JobType.NOVEL_ANALYSIS, // Use the refactored stream-capable processor
        payload: {
          projectId: body.projectId,
          filePath: body.filePath,
          sourceText: body.rawText,
          traceId,
        },
        traceId,
        isVerification: true,
        // OMIT taskId to avoid foreign key violation if no task exists
      });

      return {
        success: true,
        jobId: job.id,
        traceId,
        status: job.status,
      };
    } catch (err: any) {
      this.logger.error(`[ProdGate] Failed to trigger novel-analysis: ${err.message}`, err.stack);
      throw err;
    }
  }
}
