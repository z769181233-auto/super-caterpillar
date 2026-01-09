# Stage13 CE Core Layer 验证报告

**生成时间**: 2025-12-13  
**文档版本**: v1.0  
**状态**: 📋 验证阶段

---

## 一、环境信息

### 1.1 代码版本

- **Commit**: `$(git rev-parse HEAD)`
- **Branch**: `$(git branch --show-current)`
- **迁移文件**: `stage13_ce_core_layer`
- **Tag**: `stage13-final` (Stage13-Final 补丁后)

### 1.2 服务端口

- **API**: `http://localhost:3000`
- **Worker**: 独立进程
- **CE06 Service**: `http://localhost:8000` (环境变量 `CE06_BASE_URL`)
- **CE03 Service**: `http://localhost:8001` (环境变量 `CE03_BASE_URL`)
- **CE04 Service**: `http://localhost:8002` (环境变量 `CE04_BASE_URL`)

### 1.3 数据库

- **Provider**: PostgreSQL
- **迁移状态**: 待执行 `pnpm --filter database prisma migrate dev --name stage13_ce_core_layer`

---

## 二、执行步骤

### 2.1 Prisma 迁移

```bash
# 1. 格式化 schema
pnpm --filter database prisma format

# 2. 生成 Prisma Client
pnpm --filter database prisma generate

# 3. 创建迁移
pnpm --filter database prisma migrate dev --name stage13_ce_core_layer
```

**预期输出**:

- ✅ Schema 格式化成功
- ✅ Prisma Client 生成成功
- ✅ 迁移文件创建成功

### 2.2 构建项目

```bash
pnpm -w build
```

**预期输出**:

- ✅ API 构建成功
- ✅ Worker 构建成功
- ✅ Shared Types 构建成功

### 2.3 启动服务

```bash
# Terminal 1: 启动 API
pnpm --filter api dev

# Terminal 2: 启动 Worker
pnpm --filter workers dev
```

**预期输出**:

- ✅ API 启动成功，监听 3000 端口
- ✅ Worker 注册成功，心跳正常

---

## 三、验证用例

### 用例 1: 全成功链路（CE06 → CE03 → CE04）

#### 3.1.1 操作步骤

1. **上传小说文件**

   ```bash
   curl -X POST "http://localhost:3000/api/projects/{projectId}/novel/import-file" \
     -H "Authorization: Bearer {JWT_TOKEN}" \
     -F "file=@test-novel.txt"
   ```

2. **触发 CE Core DAG**
   - 上传小说后，系统自动创建 CE Core DAG
   - 创建 CE06 Job（第一个）

3. **等待执行完成**
   - CE06 完成 → 自动触发 CE03
   - CE03 完成 → 自动触发 CE04
   - CE04 完成 → 整个 DAG 完成

#### 3.1.2 验证点

**A. Job 状态验证**

```sql
SELECT id, type, status, trace_id, created_at, updated_at
FROM shot_jobs
WHERE project_id = '{projectId}'
  AND type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')
ORDER BY created_at;
```

**预期结果**:

- ✅ 3 条 Job 记录
- ✅ 状态均为 `SUCCEEDED`
- ✅ `trace_id` 相同（Pipeline 级 traceId，格式：`ce_pipeline_${uuid}`）
- ✅ 创建时间顺序：CE06 < CE03 < CE04

**B. 审计日志验证**

```sql
SELECT id, action, resource_id, details->>'traceId' as trace_id, details->>'engineKey' as engine, details->>'status' as status, created_at
FROM audit_logs
WHERE resource_type = 'job'
  AND resource_id IN (
    SELECT id FROM shot_jobs
    WHERE project_id = '{projectId}'
      AND type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')
  )
ORDER BY created_at;
```

**预期结果**:

- ✅ 3 条审计记录
- ✅ `action` 分别为：`CE_CE06_NOVEL_PARSING_SUCCESS`, `CE_CE03_VISUAL_DENSITY_SUCCESS`, `CE_CE04_VISUAL_ENRICHMENT_SUCCESS`
- ✅ `details.traceId` 相同
- ✅ `details.status` 均为 `SUCCESS`
- ✅ `details.inputHash` 和 `details.outputHash` 存在
- ✅ `details.latencyMs` > 0

**C. 数据落库验证**

```sql
-- NovelParseResult
SELECT id, project_id, parsing_quality, created_at
FROM novel_parse_results
WHERE project_id = '{projectId}';

-- QualityMetrics
SELECT id, project_id, engine, visual_density_score, enrichment_quality, created_at
FROM quality_metrics
WHERE project_id = '{projectId}'
ORDER BY engine, created_at;
```

**预期结果**:

- ✅ `novel_parse_results` 表有 1 条记录
- ✅ `parsing_quality` > 0
- ✅ `quality_metrics` 表有 2 条记录（CE03 和 CE04）
- ✅ CE03 记录包含 `visual_density_score`
- ✅ CE04 记录包含 `enrichment_quality`

---

### 用例 2: CE03 强制失败（后续 CE04 不执行）

#### 3.2.1 操作步骤

1. **模拟 CE03 失败**
   - 方法 1: 停止 CE03 服务（`CE03_BASE_URL` 不可访问）
   - 方法 2: 修改 Worker 代码，在 `processCE03Job` 中强制抛出错误

2. **等待执行**
   - CE06 完成 → 触发 CE03
   - CE03 失败 → CE04 不执行（标记为 FAILED）

#### 3.2.2 验证点

**A. Job 状态验证**

```sql
SELECT id, type, status, last_error, trace_id
FROM shot_jobs
WHERE project_id = '{projectId}'
  AND type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')
ORDER BY created_at;
```

**预期结果**:

- ✅ CE06: `SUCCEEDED`
- ✅ CE03: `FAILED`，`last_error` 有内容
- ✅ CE04: `FAILED`，`last_error` 包含 "Previous CE Job failed: CE03_VISUAL_DENSITY"

**B. 审计日志验证**

```sql
SELECT id, action, details->>'status' as status, details->>'errorMessage' as error, created_at
FROM audit_logs
WHERE resource_type = 'job'
  AND resource_id IN (
    SELECT id FROM shot_jobs
    WHERE project_id = '{projectId}'
      AND type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')
  )
ORDER BY created_at;
```

**预期结果**:

- ✅ CE06: `status = SUCCESS`
- ✅ CE03: `status = FAILED`，`error` 有内容
- ✅ CE04: **必须有 1 条 SKIPPED 审计记录**（Stage13-Final 补丁）
  - `action = CE_CE04_VISUAL_ENRICHMENT_SKIPPED`
  - `details.status = SKIPPED`
  - `details.reason = "Previous CE Job failed: CE03_VISUAL_DENSITY"`
  - `details.traceId` 与 CE06/CE03 相同（Pipeline 级 traceId）

---

## 四、关键日志片段

### 4.1 API 启动日志

```
[INFO] API server started on port 3000
[INFO] Engine Registry: Registered ce06_novel_parsing (http)
[INFO] Engine Registry: Registered ce03_visual_density (http)
[INFO] Engine Registry: Registered ce04_visual_enrichment (http)
```

### 4.2 Worker 处理日志

```
[INFO] CE06_JOB_START jobId=xxx projectId=xxx traceId=xxx
[INFO] CE06_JOB_SUCCESS jobId=xxx durationMs=1234 parsingQuality=0.95
[INFO] CE06 completed, triggered CE03 for project xxx
[INFO] CE03_JOB_START jobId=yyy projectId=xxx traceId=xxx
[INFO] CE03_JOB_SUCCESS jobId=yyy durationMs=567 visualDensityScore=0.87
[INFO] CE03 completed, triggered CE04 for project xxx
[INFO] CE04_JOB_START jobId=zzz projectId=xxx traceId=xxx
[INFO] CE04_JOB_SUCCESS jobId=zzz durationMs=890 enrichmentQuality=0.92
```

### 4.3 审计日志写入

```
[INFO] Audit log created: action=CE_CE06_NOVEL_PARSING_SUCCESS resourceId=xxx
[INFO] Audit log created: action=CE_CE03_VISUAL_DENSITY_SUCCESS resourceId=yyy
[INFO] Audit log created: action=CE_CE04_VISUAL_ENRICHMENT_SUCCESS resourceId=zzz
```

---

## 五、已知问题与限制

### 5.1 已知问题

- ⚠️ CE 服务需要外部 HTTP 服务支持（CE06/CE03/CE04）
- ⚠️ 验证脚本需要手动提供 JWT token 和 projectId
- ⚠️ 成本字段（cost）当前为占位值 0

### 5.2 限制

- CE Core DAG 固定执行顺序，不支持并行
- 任一 CE Job 失败，后续 Job 自动标记为 FAILED
- **traceId 机制（Stage13-Final）**：Pipeline 级 traceId（`ce_pipeline_${uuid}`），在创建 Task 时生成，所有 CE Job 共享同一个 traceId
- CE04 被阻断时，会写 SKIPPED 审计记录（补齐审计链路）

---

## 六、验收标准

### 6.1 必须满足

- ✅ Prisma 迁移成功
- ✅ API 和 Worker 启动成功
- ✅ CE06/CE03/CE04 Job 按顺序执行
- ✅ 审计日志完整记录（3 条记录，同一 traceId）
- ✅ 数据正确落库（NovelParseResult, QualityMetrics）
- ✅ 失败场景正确处理（后续 Job 不执行）

### 6.2 可选优化

- ⚠️ 成本计算（cost 字段）
- ⚠️ 更详细的 auditTrail 信息
- ⚠️ 自动化验证脚本（无需手动操作）

---

## 七、结论

**Stage13 CE Core Layer 实现完成** ✅

- ✅ 代码实现完成
- ✅ 审计集成完成
- ✅ 验证脚本就绪
- ⏳ 待执行：Prisma 迁移和实际验证

---

**下一步**:

1. 执行 Prisma 迁移
2. 启动服务
3. 执行验证用例
4. 更新本报告的实际验证结果
