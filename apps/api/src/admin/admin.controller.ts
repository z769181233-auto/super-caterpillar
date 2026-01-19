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
  async enqueueTest(@Body() body: { projectId: string; jobType: string; payload?: any }) {
    const { projectId, jobType, payload } = body;
    if (!projectId || !jobType) return { ok: false, error: 'projectId and jobType required' };

    // 这里直接创建一个 PENDING job,JobService 领取时将做 quota check 并显式 BLOCKED
    const job = await this.prisma.shotJob.create({
      data: {
        projectId,
        status: 'PENDING',
        jobType: jobType as any,
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
}
