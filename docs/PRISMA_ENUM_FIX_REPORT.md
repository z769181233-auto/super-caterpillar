# Prisma Enum Fix Report - 0雷区修复

## Step 0: 审计清单

见 `docs/PRISMA_ENUM_RISK_AUDIT.md`

## Step 1: Schema Generator 输出路径

**修改前：**
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/.prisma/client"
}
```

**修改后：**
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

**生成物位置：**
- `packages/database/src/generated/prisma/index.js`
- `packages/database/src/generated/prisma/index.d.ts`

## Step 2: 删除脆弱实现

**已删除：**
- `packages/database/src/prisma-enums.ts`（运行时路径探测）

**修改后 index.ts：**
```typescript
// ✅ 固定生成输出：从 packages/database/src/generated/prisma 导出
export * from './generated/prisma';
export type * from './generated/prisma';
```

## Step 3: 统一导入（进行中）

需要修复的文件：
- `apps/api/src/scripts/dev-create-test-novel-job.ts`
- `apps/api/src/scripts/sync-engines-from-json.ts`
- `apps/api/src/scripts/create-novel-analysis-http-test-jobs.ts`
- `apps/api/src/scripts/e2e-novel-worker-pipeline.ts`
- `apps/api/src/scripts/reset-test-jobs.ts`
- `apps/api/src/scripts/debug-jobs.ts`
- `apps/api/src/scripts/delete-worker.ts`

## Step 4: JobService 清零 any（待执行）

当前 any 使用情况：
- `type ShotJobWithShotHierarchy = any;` - 需要修复
- `payload as any` - 多处需要修复
- `job: any` - 需要修复

## Step 5-7: 其他步骤（待执行）

## Build 日志

见 `logs/regression/pnpm_build_zero_risk_v5.txt`

## Smoke 测试输出

待执行

## Any 清零统计

待执行

