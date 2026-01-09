# P0-R0 SHOT_RENDER 真出片引擎 RESEARCH 文档

> **日期**: 2026-01-09  
> **分支**: `p0/p0-r0_shot_render_real`  
> **目标**: 定位 Stub 入口、Worker 处理器、资产写入路径、计费落库链路、审计写入点

---

## 1. Stub 入口与写假 PNG 的位置

| 文件                                                | 位置     | 问题                                           |
| --------------------------------------------------- | -------- | ---------------------------------------------- |
| `packages/engines/shot_render/real.ts`              | 第 46 行 | 写入 `[FAKE PNG HEADER]\n...` 文本，非真实图片 |
| `packages/engines/shot_render/real/sdxl.adapter.ts` | 第 13 行 | 调用 `realStub`，未接入真实 API                |
| `packages/engines/shot_render/real/flux.adapter.ts` | 第 13 行 | 同上                                           |

### 调用链

```
ShotRenderSelector.invoke()
  → (REAL 模式) shotRenderRealEngine() [real/index.ts]
    → runShotRenderSDXL() [real/sdxl.adapter.ts]
      → realStub() [real.ts] ← 写入 FAKE PNG
```

---

## 2. Worker 处理 SHOT_RENDER 的处理器

| 文件                                    | 函数                     | 说明                                  |
| --------------------------------------- | ------------------------ | ------------------------------------- |
| `apps/workers/src/ce-core-processor.ts` | `processShotRenderJob()` | 第 663-873 行，Stage 4 处理器         |
| `apps/workers/src/main.ts`              | 第 476 行                | 路由判断 `job.type === 'SHOT_RENDER'` |

### 处理流程

1. 解析 input（从 payload 或 CE04 metrics）
2. 调用 `ShotRenderSelector.invoke(input)`
3. 结果写入 `Asset` 表
4. 写入 `QualityMetrics` 表
5. 调用 `CostLedgerService.recordShotRenderBilling()`
6. 调用 `apiClient.postAuditLog()`

---

## 3. 资产当前写入路径

| 变量                | 默认值                         | 来源         |
| ------------------- | ------------------------------ | ------------ |
| `ASSET_STORAGE_DIR` | `apps/workers/.runtime/assets` | `real.ts:13` |

### 当前文件命名

```
{shotId}_{seed}_{promptHash}.png
```

**问题**: 当前是文本文件伪装成 .png

---

## 4. 计费落库链路

| 服务                | 方法                        | 调用位置                       |
| ------------------- | --------------------------- | ------------------------------ |
| `CostLedgerService` | `recordShotRenderBilling()` | `ce-core-processor.ts:803-812` |

### 数据流

```
processShotRenderJob()
  → CostLedgerService.recordShotRenderBilling({
      jobId, jobType='SHOT_RENDER', traceId, projectId, userId, orgId,
      engineKey, billingUsage
    })
  → prisma.costLedger.create({ jobId, jobType, credits, ... })
```

**注意**: 幂等通过 unique(jobId, jobType) 实现，重复写入会静默忽略 (P2002)

---

## 5. 审计写入点

| 调用位置                       | 方法                       | 字段                                                                                     |
| ------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------- |
| `ce-core-processor.ts:832-850` | `apiClient.postAuditLog()` | traceId, jobId, jobType, engineKey, status, inputHash, outputHash, latencyMs, auditTrail |

### 审计字段完整性

- ✅ `traceId` - 从 job.traceId 或生成
- ✅ `engineKey` - 从 result.audit_trail.engineKey
- ✅ `auditTrail` - 引擎输出的 audit_trail 对象
- ⚠️ `auditKeyVersion` - 需确认是否通过 AuditLogService 自动注入

---

## 6. 变更计划摘要

1. **新增 Provider**: `replicate.provider.ts` - 调用 Replicate SDXL Turbo API
2. **修改 Adapter**: `sdxl.adapter.ts` - 调用 provider 而非 realStub
3. **修改 Types**: 添加 `provider` 字段
4. **新增 Gate**: `gate-p0-r0_shot_render_real.sh` - 像素验证 + 计费断言
