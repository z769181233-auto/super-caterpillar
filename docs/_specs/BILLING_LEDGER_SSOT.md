# Billing Ledger Single Source of Truth (SSOT)

> **Version**: 1.0
> **Status**: APPROVED
> **Scope**: Super Caterpillar Universe (SCU) Billing System

## 1. 核心原则 (Core Principles)

1.  **唯一性 (Uniqueness)**: `(tenantId, traceId, itemType, itemId, chargeCode)` 必须是数据库级唯一索引。
2.  **不可伪造 (Non-Falsifiable)**: 每一笔 `POSTED` 记录必须对应物理执行证据 (Job SUCCEEDED / Asset Created)。
3.  **正数原则 (Positive Only)**: `amount` 必须 >= 0。退款/回滚通过 `REVERSED` 状态或独立的 Refund 记录处理，严禁使用负数金额。
4.  **原子性 (Atomicity)**: 计费记录的产生应尽量与业务操作同事务，或通过可靠的事件驱动最终一致性 (Eventual Consistency with Reconciliation)。

## 2. 计费模型 (Cost Model)

| Item Type | Work Unit            | Charge Code  | Unit Price (Mock)    | Data Source               |
| :-------- | :------------------- | :----------- | :------------------- | :------------------------ |
| `JOB`     | `CE06_NOVEL_PARSING` | `SCAN_CHAR`  | 1 credit / 10k chars | `Job.payload.charCount`   |
| `JOB`     | `SHOT_RENDER`        | `RENDER_SEC` | 5 credits / sec      | `Asset.metadata.duration` |
| `JOB`     | `COMFY_GEN`          | `IMAGE_GEN`  | 10 credits / image   | `Asset(Type=IMAGE).count` |

## 3. 数据库 Schema 规范

```prisma
model BillingLedger {
  id          String   @id @default(uuid())
  tenantId    String
  traceId     String   // JobId or RequestId
  itemType    String   // JOB, STORAGE, API
  itemId      String   // JobId, AssetId
  chargeCode  String   // SKU
  amount      Int
  currency    String   @default("CREDIT")
  status      String   // PENDING, POSTED, REVERSED, FAILED
  evidenceRef String?  // Pointer to audit log or asset path
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, traceId, itemType, itemId, chargeCode])
  @@index([traceId])
  @@index([status])
}
```

## 4. 对账逻辑 (Reconciliation Logic)

对账器 (Reconciler) 必须验证以下等式：

$$
\sum_{i \in Jobs} Cost(i) \approx \sum_{j \in Ledger, status=POSTED} Amount(j)
$$

允许误差范围：$\pm 1\%$ (由于浮点数或统计延迟)。

## 5. 异常处理 (Exception Handling)

- **Job Failed**: Ledger 状态必须为 `FAILED` 或 `REVERSED`。严禁 `POSTED`。
- **Duplicate Trace**: 必须被 DB Unique Constraint 拦截，抛出错误。
- **Data Mismatch**: 若 Ledger amount 与物理证据 (Perf/Asset) 不符，标记为 `AUDIT_FAIL` 并报警。
