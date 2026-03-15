# CE07 Fix Manifest

| file changed | exact assertion changed | old behavior | new behavior | affects runtime? |
|---|---|---|---|---|
| `apps/api/src/engines/adapters/__tests__/ce07_memory_update.spec.ts` | 断言 `prisma.auditLog` 变为断言 `auditService.log` | 测试因为未能穿透 `mock` 调用底层 `prisma` 导致断言为 `0` 次 | 现在断言上层建筑协作接口（`jest.fn()` 挡板）是否响应调用。 | **NO** |
| `apps/api/src/engines/adapters/__tests__/ce07_memory_update.spec.ts` | 断言 `mockBillingService` 变为断言 `costLedgerService.recordFromEvent` | 被 `costLedgerService` 的 Mock 阻断，底层 Billing 不可能接到通知 | 正确指向上层已经被 Mock 隔离的服务入口。 | **NO** |
