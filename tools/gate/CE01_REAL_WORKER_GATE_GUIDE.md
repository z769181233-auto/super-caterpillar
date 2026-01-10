# CE01 真 Worker Gate 执行指南

## 前置条件

1. **数据库就绪**：`DATABASE_URL` 正确配置
2. **测试数据准备**：
   ```bash
   export TEST_TOKEN="your-valid-jwt"
   export CE01_TEST_PROJECT_ID="existing-project-uuid"
   export CE01_TEST_CHARACTER_ID="existing-character-uuid"
   ```
3. **在 repo 根目录执行所有命令**

## 执行步骤

### 1. 创建证据目录

```bash
# 在 repo 根目录
mkdir -p docs/_evidence/CE01_SEAL_20260110
```

### 2. 启动 API（严格禁用内置 Worker）

```bash
# Terminal A - repo 根目录
export GATE_MODE=1
export JOB_WORKER_ENABLED=false
export INTERNAL_WORKER_ENABLED=false
export API_INTERNAL_WORKER_ENABLED=false

pnpm --filter api dev
```

### 3. 启动 Worker

```bash
# Terminal B - repo 根目录
export WORKER_ID=worker_ce01_gate_1
export WORKER_PID_DIR="$(pwd)/apps/workers/.runtime/pids"

pnpm --filter @scu/worker dev
```

### 4. 运行 Gate 并收集输出

```bash
# Terminal C - repo 根目录
export TEST_TOKEN="your-valid-jwt"
export CE01_TEST_PROJECT_ID="existing-project-uuid"
export CE01_TEST_CHARACTER_ID="existing-character-uuid"

bash tools/gate/gates/gate-ce01_protocol_instantiation.sh 2>&1 | tee docs/_evidence/CE01_SEAL_20260110/gate_output.log
```

### 5. 收集 Worker 日志证据

从 Terminal B (Worker) 复制认领与完成的关键日志段：

```bash
# 保存 Worker 输出关键片段（包含 jobId / bindingId / status）
nano docs/_evidence/CE01_SEAL_20260110/worker_consume_log.txt
```

### 6. 导出 DB 证据

```bash
# A. binding_metadata.csv
psql "$DATABASE_URL" -c "\
COPY ( \
  SELECT id, metadata, status, created_at \
  FROM job_engine_bindings \
  WHERE engine_key='character_visual' \
  ORDER BY created_at DESC \
  LIMIT 5 \
) TO STDOUT WITH CSV HEADER" \
> docs/_evidence/CE01_SEAL_20260110/binding_metadata.csv

# B. org_verification.csv
psql "$DATABASE_URL" -c "\
COPY ( \
  SELECT b.id, b.engine_key, j.organization_id, j.project_id \
  FROM job_engine_bindings b \
  JOIN shot_jobs j ON b.job_id=j.id \
  WHERE b.engine_key='character_visual' \
  ORDER BY j.created_at DESC \
  LIMIT 20 \
) TO STDOUT WITH CSV HEADER" \
> docs/_evidence/CE01_SEAL_20260110/org_verification.csv
```

### 7. 完成封板提交

```bash
# 在 repo 根目录
pnpm -w run typecheck

git status
git add -A
git commit -m "feat(ce01): seal protocol instantiation + downstream enforcement (real worker gate evidence)"
git tag -a p1-ce01-protocol-sealed-20260110 -m "CE01 sealed: scope-idempotency + metadata merge + downstream enforcement + real gate evidence"

git push origin HEAD --tags
```

## 验收标准

✅ Gate Exit 0
✅ Worker 日志显示 Job 被认领并完成
✅ JobEngineBinding.metadata 包含 artifacts
✅ 所有 DB 查询返回预期结果
✅ commit + tag + push 完成
