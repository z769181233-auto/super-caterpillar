import { Body, Controller, Post } from '@nestjs/common';
import { GateModeGuard } from './gate-mode.guard';
import { UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerService } from '../worker/worker.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

@Controller('admin')
@UseGuards(GateModeGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workerService: WorkerService,
    private readonly orchestratorService: OrchestratorService
  ) {}

  // POST /admin/workers/reclaim
  @Post('workers/reclaim')
  async reclaim() {
    const reclaimed = await this.workerService.reclaimJobsFromDeadWorkers();
    return { reclaimed };
  }

  // POST /admin/billing/set-credits  {orgId, credits}
  @Post('billing/set-credits')
  async setCredits(@Body() body: { orgId: string; credits: number }) {
    const { orgId, credits } = body;
    if (!orgId || typeof credits !== 'number') {
      return { ok: false, error: 'orgId and credits required' };
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { credits },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'ADMIN_SET_CREDITS',
        organizationId: orgId,
        metadata: { credits },
      } as any,
    });

    return { ok: true };
  }

  // POST /admin/jobs/enqueue-test {projectId, jobType, payload}
  @Post('jobs/enqueue-test')
  async enqueueTest(
    @Body()
    body: {
      projectId: string;
      jobType: string;
      payload?: any;
      organizationId?: string;
      priority?: number;
    }
  ) {
    const { projectId, jobType, payload, organizationId, priority } = body;
    if (!projectId || !jobType) return { ok: false, error: 'projectId and jobType required' };

    let finalOrgId = organizationId;
    if (!finalOrgId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      finalOrgId = project?.organizationId;
    }
    if (!finalOrgId)
      return { ok: false, error: 'organizationId required or not found via project' };

    // 这里直接创建一个 PENDING job,JobService 领取时将做 quota check 并显式 BLOCKED
    const job = await this.prisma.shotJob.create({
      data: {
        projectId,
        organizationId: finalOrgId,
        priority: priority ?? 0,
        status: 'PENDING',
        type: jobType as any,
        payload: (payload ?? {}) as any,
        traceId: `gate_enqueue_${Date.now()}`,
      } as any,
      select: { id: true },
    });

    return { ok: true, jobId: job.id };
  }

  // POST /admin/prod-gate/stage1-pipeline {novelText, projectId, organizationId}
  @Post('prod-gate/stage1-pipeline')
  async startStage1Pipeline(
    @Body() body: { novelText: string; projectId?: string; organizationId?: string }
  ) {
    const result = await this.orchestratorService.startStage1Pipeline(body);
    return { success: true, data: result };
  }

  // POST /admin/trigger/stage4/scan {storageKey, projectId, organizationId}
  @Post('trigger/stage4/scan')
  async triggerStage4Scan(
    @Body() body: { storageKey: string; projectId: string; organizationId: string }
  ) {
    const { storageKey, projectId, organizationId } = body;
    if (!storageKey || !projectId || !organizationId) {
      return { ok: false, error: 'storageKey, projectId and organizationId required' };
    }

    // 1. 确保用户存在 (用于 ownerId)
    const dummyUserId = 'case-c-stress-user';
    await this.prisma.user.upsert({
      where: { id: dummyUserId },
      update: {},
      create: {
        id: dummyUserId,
        email: 'case-c-stress@test.local',
        passwordHash: '$2b$10$dummyhash',
      },
    });

    // 2. 确保组织存在
    await this.prisma.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: {
        id: organizationId,
        name: 'Case C Stress Organization',
        ownerId: dummyUserId,
      },
    });

    // 3. 确保项目存在
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        name: 'Case C Stress Project',
        organizationId,
        ownerId: dummyUserId,
        status: 'in_progress',
      },
    });

    const job = await this.prisma.shotJob.create({
      data: {
        organizationId,
        projectId,
        type: 'NOVEL_SCAN_TOC',
        status: 'PENDING',
        priority: 100,
        payload: {
          projectId,
          fileKey: storageKey,
          isVerification: true,
        },
      } as any,
    });

    return { ok: true, jobId: job.id, projectId };
  }
}
