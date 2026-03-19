export type LegacyBillingState = 'RESERVED' | 'COMMITTED' | 'RELEASED' | string;

export type BillingLedgerSsotStatus = 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';

export function mapLegacyBillingStateToSsotStatus(
  billingState?: LegacyBillingState | null
): BillingLedgerSsotStatus {
  switch (String(billingState || '').toUpperCase()) {
    case 'RESERVED':
      return 'PENDING';
    case 'COMMITTED':
      return 'POSTED';
    case 'RELEASED':
      return 'REVERSED';
    default:
      return 'FAILED';
  }
}

export function mapLegacyBillingStateToChargeCode(billingState?: LegacyBillingState | null): string {
  switch (String(billingState || '').toUpperCase()) {
    case 'RESERVED':
      return 'JOB_RESERVED';
    case 'COMMITTED':
      return 'JOB_COMMITTED';
    case 'RELEASED':
      return 'JOB_RELEASED';
    default:
      return 'JOB_UNKNOWN';
  }
}

export function buildLegacyBillingLedgerIdempotencyKey(jobId: string, billingState: string): string {
  return `${jobId}_${String(billingState || '').toUpperCase()}`;
}

export function buildLegacyBillingLedgerCreateData(params: {
  jobId: string;
  projectId: string;
  tenantId?: string | null;
  billingState: string;
  amount: bigint;
  status?: BillingLedgerSsotStatus;
  evidenceRef?: string | null;
}) {
  const billingState = String(params.billingState || '').toUpperCase();
  const status = params.status || mapLegacyBillingStateToSsotStatus(billingState);
  return {
    jobId: params.jobId,
    projectId: params.projectId,
    billingState,
    traceId: params.jobId,
    itemType: 'JOB',
    itemId: params.jobId,
    chargeCode: mapLegacyBillingStateToChargeCode(billingState),
    amount: params.amount,
    currency: 'CREDIT',
    evidenceRef: params.evidenceRef || null,
    idempotencyKey: buildLegacyBillingLedgerIdempotencyKey(params.jobId, billingState),
    tenantId: params.tenantId || params.projectId,
    status,
  };
}

export function normalizeLegacyBillingLedgerRow<
  T extends {
    jobId: string;
    projectId: string;
    billingState: string;
    amount: bigint;
    status?: string | null;
    tenantId?: string | null;
  },
>(row: T) {
  return {
    ...row,
    tenantId: row.tenantId || row.projectId,
    traceId: row.jobId,
    itemType: 'JOB',
    itemId: row.jobId,
    chargeCode: mapLegacyBillingStateToChargeCode(row.billingState),
    status: (row.status as BillingLedgerSsotStatus | null) || mapLegacyBillingStateToSsotStatus(row.billingState),
  };
}
