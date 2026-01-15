# Stage 1 isVerification 传播验证 - 最终证据

## 验证时间
2026-01-14 20:38-20:46 +0700

## 核心目标
验证 Stage 1 DAG 中 `isVerification` 标记从 SHOT_RENDER 正确传播到 VIDEO_RENDER，并确保验证作业不污染账本。

## 修复内容摘要

### 1. JobService.ensureVideoRenderJob 修复
- **文件**: `apps/api/src/job/job.service.ts`
- **改动**:
  - 添加 `isVerification` 参数（默认 false）
  - shotJob.create 写入 `isVerification` 字段
  - task.payload 包含 `isVerification`
  - 幂等一致性防御：拒绝复用旧的非验证作业（抛出 `VIDEO_RENDER_VERIFICATION_MISMATCH`）
  - engine binding metadata 记录验证标记

### 2. 调用端传播修复
- **job-report.facade.ts**: SHOT_RENDER 完成触发 VIDEO_RENDER 时继承 `isVerification`
- **job.service.ts** (triggerStage1PipelineAssemble): 从 succeeded shots 继承 `isVerification`

### 3. JobService.create 强幂等（之前已完成）
- dedupeKey 强幂等检查
- 并发冲突兜底（P2002 unique violation）

## SQL 证据

### 证据 1: isVerification 传播验证
```sql
SELECT type, is_verification, status, id 
FROM shot_jobs 
WHERE payload->'pipelineRunId' = '"stage1_2378878e-ffd3-4191-a14b-56bef6df5265"' 
ORDER BY "createdAt" ASC;
```

**结果**: (见 sql_evidence_jobs.txt)
- PIPELINE_STAGE1: is_verification = false（正常，非验证作业）
- SHOT_RENDER (x3): is_verification = **true** ✅
- VIDEO_RENDER: is_verification = **true** ✅

### 证据 2: 账本零污染验证
```sql
SELECT COUNT(*) as ledger_count 
FROM cost_ledgers cl 
JOIN shot_jobs sj ON cl."jobId" = sj.id 
WHERE sj."is_verification" = true;
```

**结果**: (见 sql_evidence_ledger.txt)
- ledger_count = **0** ✅

## 关键不变量

1. **验证标记传播**: 同一 pipelineRunId 下的所有验证作业（SHOT_RENDER）必须将 `isVerification=true` 传播到 VIDEO_RENDER
2. **账本隔离**: 任何 `is_verification=true` 的作业不得产生 cost_ledgers 记录
3. **幂等一致性**: 当需要 `isVerification=true` 时，不得复用旧的 `isVerification=false` 作业

## 防御机制

- **ensureVideoRenderJob** 幂等检查中的一致性防御
- **JobService.create** 的 dedupeKey 强幂等
- **reportJobResult** 中的 `!isVerification` 账本过滤

## 文件清单

- `RUN_ID.txt`: pipelineRunId 和关键作业 ID
- `sql_evidence_jobs.txt`: 作业 is_verification 状态证据
- `sql_evidence_ledger.txt`: 账本零污染证据
- `SUMMARY.md`: 本文档

## 结论

✅ **商业级修复完成**
- isVerification 正确传播到 VIDEO_RENDER
- 验证作业账本零污染
- 幂等一致性防御到位
- 符合成本管理与计费体系要求
