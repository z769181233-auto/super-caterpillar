import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { BudgetLevel, BudgetService } from '../../billing/budget.service';
import { BudgetGuard } from './budget.guard';

interface MockBudgetRequest {
  apiKeyOwnerOrgId?: string;
  user?: { userId?: string; organizationId?: string };
  headers: Record<string, string>;
  budgetLevel?: BudgetLevel;
  budgetRatio?: number;
}

function createExecutionContext(request: MockBudgetRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createGuard() {
  const budgetService = {
    getBudgetStatus: jest.fn().mockResolvedValue({ ratio: 0.1, level: BudgetLevel.OK }),
  };
  const auditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const guard = new BudgetGuard(
    budgetService as unknown as BudgetService,
    auditLogService as unknown as AuditLogService
  );
  return { budgetService, auditLogService, guard };
}

describe('BudgetGuard', () => {
  it('uses the authenticated user organization before organization headers', async () => {
    const { budgetService, guard } = createGuard();
    const request = {
      user: { userId: 'user-1', organizationId: 'org-from-user' },
      headers: { 'x-organization-id': 'org-from-header' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);

    expect(budgetService.getBudgetStatus).toHaveBeenCalledWith('org-from-user');
    expect(request).toEqual(expect.objectContaining({ budgetLevel: BudgetLevel.OK, budgetRatio: 0.1 }));
  });

  it('uses the HMAC api key owner organization before organization headers', async () => {
    const { budgetService, guard } = createGuard();
    const request = {
      apiKeyOwnerOrgId: 'org-from-api-key',
      user: { userId: 'user-1', organizationId: 'org-from-user' },
      headers: { 'x-org-id': 'org-from-header' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);

    expect(budgetService.getBudgetStatus).toHaveBeenCalledWith('org-from-api-key');
  });

  it('uses compatible organization headers when authenticated org context is absent', async () => {
    const { budgetService, guard } = createGuard();
    const request = {
      user: { userId: 'user-1' },
      headers: { 'x-scu-org-id': 'org-from-scu-header' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);

    expect(budgetService.getBudgetStatus).toHaveBeenCalledWith('org-from-scu-header');
  });

  it('rejects requests without any organization context', async () => {
    const { budgetService, guard } = createGuard();
    const request = { user: { userId: 'user-1' }, headers: {} };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(budgetService.getBudgetStatus).not.toHaveBeenCalled();
  });
});
