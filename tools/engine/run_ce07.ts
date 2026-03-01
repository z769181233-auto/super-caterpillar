import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import {
  CE07MemoryUpdateAdapter,
  CE07MemoryInput,
} from '../../apps/api/src/engines/adapters/ce07_memory_update.local.adapter';
import { randomUUID } from 'crypto';

// Mock BillingService for standalone run
const mockBillingService = {
  consumeCredits: async () => true,
  checkBalance: async () => true,
} as any;

async function main() {
  // Use environment variable for DB URL or default
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const auditService = new AuditService(prisma);
    const costLedgerService = new CostLedgerService(prisma, mockBillingService);
    const adapter = new CE07MemoryUpdateAdapter(prisma, auditService, costLedgerService);

    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);

    // Create necessary DB entities to satisfy FK constraints
    const user = await prisma.user.create({
      data: { email: `runner_ce07_${suffix}@example.com`, passwordHash: 'x' },
    });
    const org = await prisma.organization.create({
      data: { name: `RunnerOrg_${suffix}`, ownerId: user.id },
    });
    const project = await prisma.project.create({
      data: { name: `RunnerProject_${suffix}`, organizationId: org.id, ownerId: user.id },
    });
    const task = await prisma.task.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        type: 'CE_CORE_PIPELINE',
        status: 'RUNNING',
      },
    });
    const job = await prisma.shotJob.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        taskId: task.id,
        type: 'CE07_MEMORY_UPDATE',
        status: 'SUCCEEDED',
        attempts: 1,
      },
    });

    const input: CE07MemoryInput = {
      characterId: `char_${suffix}`,
      sceneId: `scene_${suffix}`,
      memoryType: 'knowledge',
      content: `Runner memory content ${suffix}`,
    };

    const traceId = `trace_${suffix}`;
    const result = await adapter.invoke({
      payload: input,
      context: {
        projectId: project.id,
        organizationId: org.id,
        userId: user.id,
        traceId: traceId,
        jobId: job.id,
        attempt: 1,
      },
      engineKey: adapter.name,
      jobType: 'CE07_MEMORY_UPDATE',
    });

    // Verification queries (to include in output)
    const cm = await prisma.characterMemory.findFirst({
      where: { characterId: input.characterId },
    });
    const audit = await prisma.auditLog.findFirst({
      where: { resourceId: cm?.id, action: 'CE07_MEMORY_UPDATE' },
    });
    const ledger = await prisma.costLedger.findFirst({ where: { jobId: job.id } });

    const fullOutput = {
      adapterResult: result,
      verification: {
        characterMemory: cm ? 'FOUND' : 'MISSING',
        auditLog: audit ? 'FOUND' : 'MISSING',
        costLedger: ledger ? 'FOUND' : 'MISSING',
        ids: {
          cmId: cm?.id,
          auditId: audit?.id,
          ledgerId: ledger?.id,
        },
      },
    };

    console.log(JSON.stringify(fullOutput, null, 2));

    // Cleanup
    // Delete dependents first
    if (ledger)
      await prisma.costLedger
        .deleteMany({ where: { jobId: job.id } })
        .catch((e) => console.error('Cleanup ledger failed', e.message));
    await prisma.shotJob
      .deleteMany({ where: { projectId: project.id } })
      .catch((e) => console.error('Cleanup jobs failed', e.message));
    await prisma.task
      .deleteMany({ where: { projectId: project.id } })
      .catch((e) => console.error('Cleanup tasks failed', e.message));

    // Memory and Audit
    if (cm)
      await prisma.characterMemory
        .deleteMany({ where: { characterId: input.characterId } })
        .catch(() => {});
    if (fullOutput.adapterResult.output?.recordIds?.sceneMemoryId)
      await prisma.sceneMemory.deleteMany({ where: { sceneId: input.sceneId } }).catch(() => {});
    // Audit logs usually immutable, but for cleanup we can try if permissions allow (or ignore)

    await prisma.project
      .delete({ where: { id: project.id } })
      .catch((e) => console.error('Cleanup project failed', e.message));
    await prisma.organization
      .delete({ where: { id: org.id } })
      .catch((e) => console.error('Cleanup org failed', e.message));
    await prisma.user
      .delete({ where: { id: user.id } })
      .catch((e) => console.error('Cleanup user failed', e.message));

    if (String(result.status).toUpperCase() !== 'SUCCESS') {
      process.exit(1);
    }
    if (!cm || !audit || !ledger) {
      process.exit(2); // Verification failed
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
