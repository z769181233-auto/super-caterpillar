export type LegacyBillingState = 'RESERVED' | 'COMMITTED' | 'RELEASED' | string;

export type BillingLedgerSsotStatus = 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function requireNonEmptyString(value: unknown, code: string): string {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}

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
    requireNonEmptyString(params.tenantId, 'BILLING_TENANT_ID_REQUIRED'),
    requireNonEmptyString(params.traceId, 'BILLING_TRACE_ID_REQUIRED'),
    requireNonEmptyString(params.itemType, 'BILLING_ITEM_TYPE_REQUIRED'),
    requireNonEmptyString(params.itemId, 'BILLING_ITEM_ID_REQUIRED'),
    requireNonEmptyString(params.chargeCode, 'BILLING_CHARGE_CODE_REQUIRED'),
  ]
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
  const traceId = requireNonEmptyString(params.traceId, 'BILLING_TRACE_ID_REQUIRED');
  const tenantId = requireNonEmptyString(params.tenantId, 'BILLING_TENANT_ID_REQUIRED');
  const itemType = requireNonEmptyString(params.itemType, 'BILLING_ITEM_TYPE_REQUIRED');
  const itemId = requireNonEmptyString(params.itemId, 'BILLING_ITEM_ID_REQUIRED');
  const chargeCode = requireNonEmptyString(params.chargeCode, 'BILLING_CHARGE_CODE_REQUIRED');
  const jobId = requireNonEmptyString(params.jobId, 'BILLING_JOB_ID_REQUIRED');
  const projectId = requireNonEmptyString(params.projectId, 'BILLING_PROJECT_ID_REQUIRED');

  return {
    jobId,
    projectId,
    billingState: legacyBillingState ?? 'FAILED',
    traceId,
    itemType,
    itemId,
    chargeCode,
    amount: params.amount,
    currency: 'CREDIT',
    evidenceRef: params.evidenceRef || null,
    idempotencyKey: buildBillingLedgerSsotIdempotencyKey({
      tenantId,
      traceId,
      itemType,
      itemId,
      chargeCode,
    }),
    tenantId,
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
    tenantId: requireNonEmptyString(
      params.tenantId ?? params.projectId,
      'BILLING_TENANT_ID_REQUIRED'
    ),
    traceId: requireNonEmptyString(params.jobId, 'BILLING_TRACE_ID_REQUIRED'),
    itemType: 'JOB',
    itemId: requireNonEmptyString(params.jobId, 'BILLING_ITEM_ID_REQUIRED'),
    chargeCode: mapLegacyBillingStateToChargeCode(billingState),
    amount: params.amount,
    status,
    projectId: requireNonEmptyString(params.projectId, 'BILLING_PROJECT_ID_REQUIRED'),
    jobId: requireNonEmptyString(params.jobId, 'BILLING_JOB_ID_REQUIRED'),
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
