export type LegacyBillingState = 'RESERVED' | 'COMMITTED' | 'RELEASED' | string;

export type BillingLedgerSsotStatus = 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';

export function mapSsotStatusToLegacyBillingState(
  status: BillingLedgerSsotStatus
): LegacyBillingState | null {
  switch (status) {
    case 'PENDING':
      return 'RESERVED';
    case 'POSTED':
      return 'COMMITTED';
    case 'REVERSED':
      return 'RELEASED';
    case 'FAILED':
    default:
      return null;
  }
}

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

export function buildBillingLedgerStatusWhere(status: BillingLedgerSsotStatus) {
  const legacyBillingState = mapSsotStatusToLegacyBillingState(status);
  if (!legacyBillingState) {
    return { status };
  }
  return {
    OR: [{ status }, { billingState: legacyBillingState }],
  };
}

export function buildLegacyBillingLedgerIdempotencyKey(jobId: string, billingState: string): string {
  return `${jobId}_${String(billingState || '').toUpperCase()}`;
}

export function buildBillingLedgerSsotIdempotencyKey(params: {
  tenantId: string;
  traceId: string;
  itemType: string;
  itemId: string;
  chargeCode: string;
}): string {
  return [
    params.tenantId,
    params.traceId,
    params.itemType,
    params.itemId,
    params.chargeCode,
  ]
    .map((part) => String(part || '').trim())
    .join(':');
}

export function buildBillingLedgerCreateData(params: {
  tenantId: string;
  traceId: string;
  itemType: string;
  itemId: string;
  chargeCode: string;
  amount: bigint;
  status: BillingLedgerSsotStatus;
  projectId?: string | null;
  jobId?: string | null;
  evidenceRef?: string | null;
}) {
  const legacyBillingState = mapSsotStatusToLegacyBillingState(params.status);
  const jobId = params.jobId || params.traceId;
  const projectId = params.projectId || params.tenantId;

  return {
    jobId,
    projectId,
    billingState: legacyBillingState || 'UNKNOWN',
    traceId: params.traceId,
    itemType: params.itemType,
    itemId: params.itemId,
    chargeCode: params.chargeCode,
    amount: params.amount,
    currency: 'CREDIT',
    evidenceRef: params.evidenceRef || null,
    idempotencyKey: buildBillingLedgerSsotIdempotencyKey({
      tenantId: params.tenantId,
      traceId: params.traceId,
      itemType: params.itemType,
      itemId: params.itemId,
      chargeCode: params.chargeCode,
    }),
    tenantId: params.tenantId,
    status: params.status,
  };
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
  return buildBillingLedgerCreateData({
    tenantId: params.tenantId || params.projectId,
    traceId: params.jobId,
    itemType: 'JOB',
    itemId: params.jobId,
    chargeCode: mapLegacyBillingStateToChargeCode(billingState),
    amount: params.amount,
    status,
    projectId: params.projectId,
    jobId: params.jobId,
    evidenceRef: params.evidenceRef || null,
  });
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
