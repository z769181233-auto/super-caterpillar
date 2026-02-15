import { CE07MemoryUpdateAdapter, CE07MemoryInput } from '../ce07_memory_update.adapter';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { CostLedgerService } from '../../../cost/cost-ledger.service';
import { BillingService } from '../../../billing/billing.service';
import { randomUUID } from 'crypto';

describe('ce07_memory_update integration', () => {
  let prisma: PrismaService;
  let adapter: CE07MemoryUpdateAdapter;
  let costLedgerService: CostLedgerService;
  let auditService: AuditService;

  // Mock BillingService with Jest syntax
  const mockBillingService = {
    consumeCredits: jest.fn().mockResolvedValue(true),
    checkBalance: jest.fn().mockResolvedValue(true),
  } as unknown as BillingService;

  // Test Data
  let userId: string;
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    // Setup deps
    auditService = new AuditService(prisma);
    costLedgerService = new CostLedgerService(prisma, mockBillingService);
    adapter = new CE07MemoryUpdateAdapter(prisma, auditService, costLedgerService);

    // Seed basic data
    const uniqueSuffix = randomUUID().replace(/-/g, '').substring(0, 10);

    // Create User
    const user = await prisma.user.create({
      data: {
        email: `test_ce07_${uniqueSuffix}@example.com`,
        passwordHash: 'hash',
      },
    });
    userId = user.id;

    // Create Org
    const orgReal = await prisma.organization.create({
      data: {
        name: `TestOrg_${uniqueSuffix}`,
        ownerId: userId,
      },
    });
    orgId = orgReal.id;

    // Create Project
    const project = await prisma.project.create({
      data: {
        name: `TestProject_${uniqueSuffix}`,
        organizationId: orgId,
        ownerId: userId,
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => { });
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => { });
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => { });
    await prisma.$disconnect();
  });

  it('should write memory, audit, and ledger', async () => {
    const charId = 'char_' + randomUUID();
    const sceneId = 'scene_' + randomUUID();
    const traceId = 'trace_' + randomUUID();
    const jobId = 'job_' + randomUUID();

    // Create Task (valid type)
    const task = await prisma.task.create({
      data: {
        organizationId: orgId,
        projectId: projectId,
        type: 'CE_CORE_PIPELINE',
        status: 'RUNNING',
      },
    });

    // Create Job (valid type from SSOT)
    await prisma.shotJob.create({
      data: {
        id: jobId,
        organizationId: orgId,
        projectId: projectId,
        taskId: task.id,
        type: 'CE07_MEMORY_UPDATE',
        status: 'SUCCEEDED',
      },
    });

    const input: CE07MemoryInput = {
      characterId: charId,
      sceneId: sceneId,
      memoryType: 'emotion',
      content: 'Test memory content integration',
    };
    // Context
    const context = {
      projectId,
      organizationId: orgId,
      userId,
      traceId,
      jobId: jobId,
      attempt: 1,
    };

    const result = await adapter.invoke({
      payload: input,
      context,
      engineKey: adapter.name,
      jobType: 'CE07_MEMORY_UPDATE',
    });

    if (String(result.status).toUpperCase() !== 'SUCCESS') {
      console.error('Adapter failed:', result.error);
    }

    expect(String(result.status).toUpperCase()).toBe('SUCCESS');

    // Verify DB
    const cm = await prisma.characterMemory.findFirst({
      where: { characterId: charId },
    });
    expect(cm).toBeTruthy();
    expect(cm?.content).toBe(input.content);

    const sm = await prisma.sceneMemory.findFirst({
      where: { sceneId: sceneId },
    });
    expect(sm).toBeTruthy();

    // Verify Audit (By Resource Id)
    const audit = await prisma.auditLog.findFirst({
      where: {
        resourceId: cm!.id,
        action: 'CE07_MEMORY_UPDATE',
      },
    });
    expect(audit).toBeTruthy();

    // Verify BillingLedger
    const ledgerByJob = await prisma.billingLedger.findFirst({
      where: { itemId: jobId },
    });
    expect(ledgerByJob).toBeTruthy();
    expect(ledgerByJob?.chargeCode).toBe('ce07_memory_update');
  });
});
