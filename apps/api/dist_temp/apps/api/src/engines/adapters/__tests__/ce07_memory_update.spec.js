"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ce07_memory_update_adapter_1 = require("../ce07_memory_update.adapter");
const crypto_1 = require("crypto");
describe('ce07_memory_update integration (Mocked)', () => {
    let prisma;
    let adapter;
    let costLedgerService;
    let auditService;
    const mockBillingService = {
        consumeCredits: jest.fn().mockResolvedValue({ success: true, amountDeducted: 0 }),
        checkBalance: jest.fn().mockResolvedValue(true),
    };
    const userId = 'user_' + (0, crypto_1.randomUUID)();
    const orgId = 'org_' + (0, crypto_1.randomUUID)();
    const projectId = 'proj_' + (0, crypto_1.randomUUID)();
    beforeEach(() => {
        const mockCmId = 'cm_' + (0, crypto_1.randomUUID)();
        const mockSmId = 'sm_' + (0, crypto_1.randomUUID)();
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
                create: jest.fn().mockResolvedValue({ id: 'task_' + (0, crypto_1.randomUUID)() }),
            },
            shotJob: {
                create: jest.fn().mockResolvedValue({}),
                findUnique: jest.fn().mockResolvedValue({
                    id: 'job-1',
                    type: 'CE07_MEMORY_UPDATE',
                    status: 'SUCCEEDED'
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
        auditService = { log: jest.fn().mockResolvedValue(undefined) };
        costLedgerService = { recordFromEvent: jest.fn().mockResolvedValue(undefined) };
        adapter = new ce07_memory_update_adapter_1.CE07MemoryUpdateAdapter(prisma, auditService, costLedgerService);
    });
    it('should write memory, audit, and ledger', async () => {
        const charId = 'char_' + (0, crypto_1.randomUUID)();
        const sceneId = 'scene_' + (0, crypto_1.randomUUID)();
        const traceId = 'trace_' + (0, crypto_1.randomUUID)();
        const jobId = 'job_' + (0, crypto_1.randomUUID)();
        const input = {
            characterId: charId,
            sceneId: sceneId,
            memoryType: 'emotion',
            content: 'Test memory content integration',
        };
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
        expect(prisma.characterMemory.create).toHaveBeenCalled();
        expect(prisma.sceneMemory.create).toHaveBeenCalled();
        expect(auditService.log).toHaveBeenCalled();
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(costLedgerService.recordFromEvent).toHaveBeenCalled();
        const cm = await prisma.characterMemory.findFirst({ where: { characterId: charId } });
        expect(cm).toBeTruthy();
        expect(cm?.content).toBe(input.content);
    });
});
//# sourceMappingURL=ce07_memory_update.spec.js.map