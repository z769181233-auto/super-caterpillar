import { CE07MemoryUpdateAdapter, CE07MemoryInput } from '../ce07_memory_update.adapter';
import { AuditService } from '../../../audit/audit.service';
import { CostLedgerService } from '../../../cost/cost-ledger.service';
import { BillingService } from '../../../billing/billing.service';
import { randomUUID } from 'crypto';

describe('ce07_memory_update integration (Mocked)', () => {
  let prisma: any;
  let adapter: CE07MemoryUpdateAdapter;
  let costLedgerService: CostLedgerService;
  let auditService: AuditService;

  const mockBillingService = {
    consumeCredits: jest.fn().mockResolvedValue({ success: true, amountDeducted: 0 }),
    checkBalance: jest.fn().mockResolvedValue(true),
  } as unknown as BillingService;

  // Test Data
  const userId = 'user_' + randomUUID();
  const orgId = 'org_' + randomUUID();
  const projectId = 'proj_' + randomUUID();

  beforeEach(() => {
    // Shared IDs for cross-verification
    const mockCmId = 'cm_' + randomUUID();
    const mockSmId = 'sm_' + randomUUID();

    // Comprehensive Prisma Mock to satisfy adapter requirements
    prisma = {
      user: {
        create: jest.fn().mockResolvedValue({ id: userId }),
        delete: jest.fn().mockResolvedValue({}),
      },
      organization: {
        create: jest.fn().mockResolvedValue({ id: orgId }),
        delete: jest.fn().mockResolvedValue({}),
      },
      project: {
        create: jest.fn().mockResolvedValue({ id: projectId }),
        delete: jest.fn().mockResolvedValue({}),
      },
      task: {
        create: jest.fn().mockResolvedValue({ id: 'task_' + randomUUID() }),
      },
      shotJob: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-1',
          type: 'CE07_MEMORY_UPDATE',
          status: 'SUCCEEDED' // Required by CostLedgerService
        }),
      },
      characterMemory: {
        create: jest.fn().mockResolvedValue({ id: mockCmId, content: 'mocked' }),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve({ id: mockCmId, content: 'Test memory content integration' })),
        findUnique: jest.fn().mockResolvedValue({ id: mockCmId, content: 'Test memory content integration' }),
      },
      sceneMemory: {
        create: jest.fn().mockResolvedValue({ id: mockSmId }),
        findFirst: jest.fn().mockResolvedValue({ id: mockSmId }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      billingLedger: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ id: 'ledger-1', billingState: 'BILLED' }),
      },
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    // Setup deps
    auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;
    costLedgerService = { recordFromEvent: jest.fn().mockResolvedValue(undefined) } as any;
    adapter = new CE07MemoryUpdateAdapter(prisma, auditService, costLedgerService);
  });

  it('should write memory, audit, and ledger', async () => {
    const charId = 'char_' + randomUUID();
    const sceneId = 'scene_' + randomUUID();
    const traceId = 'trace_' + randomUUID();
    const jobId = 'job_' + randomUUID();

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
      jobId,
      attempt: 1,
    };

    const result = await adapter.invoke({
      payload: input,
      context,
      engineKey: adapter.name,
      jobType: 'CE07_MEMORY_UPDATE',
    });

    if (result.status === 'FAILED') {
      console.error('Test Result Error:', result.error);
    }

    expect(String(result.status).toUpperCase()).toBe('SUCCESS');

    // Verify DB calls
    expect(prisma.characterMemory.create).toHaveBeenCalled();
    expect(prisma.sceneMemory.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();

    // Verify Billing Service call (called via CostLedgerService)
    expect(mockBillingService.consumeCredits).toHaveBeenCalled();

    // Verification queries
    const cm = await prisma.characterMemory.findFirst({ where: { characterId: charId } });
    expect(cm).toBeTruthy();
    expect(cm?.content).toBe(input.content);
  });
});
