import { buildBillingLedgerSsotIdempotencyKey } from './billing-ledger-compat.util';

describe('billing-ledger-compat util', () => {
  it('hashes overly long ssot idempotency keys to fit billing_ledger limits', () => {
    const key = buildBillingLedgerSsotIdempotencyKey({
      tenantId: '056a9056-7bc9-4aa4-aeb6-8fc8d72aed5b:worker-reserve',
      traceId: 'facc9c5a-a1d0-4df4-8c12-fbd6df1bec03',
      itemType: 'JOB',
      itemId: 'facc9c5a-a1d0-4df4-8c12-fbd6df1bec03',
      chargeCode: 'JOB_RESERVED',
    });

    expect(key).toMatch(/^ssot:[a-f0-9]{64}$/);
    expect(key.length).toBeLessThanOrEqual(128);
  });

  it('keeps short ssot idempotency keys readable', () => {
    const key = buildBillingLedgerSsotIdempotencyKey({
      tenantId: 'tenant',
      traceId: 'trace',
      itemType: 'JOB',
      itemId: 'job',
      chargeCode: 'JOB_RESERVED',
    });

    expect(key).toBe('tenant:trace:JOB:job:JOB_RESERVED');
  });
});
