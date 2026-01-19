# CE01 Gate 启动问题解决方案

## 问题诊断

### 1. API 端口占用（EADDRINUSE: address already in use :::3000）

**原因**：已有 API 实例运行在端口 3000
**解决**：使用已运行的 API 实例，无需重新启动

### 2. Worker 认证失败（Missing auth header）

**原因**：Worker 需要 WORKER_API_KEY 和 WORKER_API_SECRET 环境变量
**解决**：配置 Worker 认证凭证或使用绕过模式

## 快速修复方案

### 方案 A：使用已运行的 API + 配置 Worker 凭证

1. **不要重新启动 API**（已有实例在 3000 端口运行）

2. **配置 Worker 认证**（Terminal B）：

```bash
# 在 repo 根目录
export WORKER_ID=worker_ce01_gate_1
export WORKER_PID_DIR="$(pwd)/apps/workers/.runtime/pids"

# 添加认证凭证（从 .env 或 .env.local 中获取，或使用测试凭证）
export WORKER_API_KEY="your-worker-api-key"
export WORKER_API_SECRET="your-worker-api-secret"

# 或者，如果有绕过认证的开关
export SCU_GATE_ALLOW_TEMP_BYPASS=1

pnpm --filter @scu/worker dev
```

### 方案 B：完全重启（先清理端口）

1. **停止所有 API 实例**：

```bash
# 找到占用 3000 端口的进程
lsof -ti:3000 | xargs kill -9

# 或者手动停止所有相关终端
```

2. **然后按原指南重新启动**

## 推荐：方案 A（使用已运行 API）

由于您已有 API 实例运行，建议：

1. **检查 API 状态**：

```bash
curl http://localhost:3000/health
```

2. **配置 Worker 并启动**：

```bash
export WORKER_ID=worker_ce01_gate_1
export WORKER_PID_DIR="$(pwd)/apps/workers/.runtime/pids"
export JOB_WORKER_ENABLED=true  # 允许 Worker 处理 Job
export SCU_GATE_ALLOW_TEMP_BYPASS=1  # 临时绕过严格认证（仅用于 Gate）

pnpm --filter @scu/worker dev
```

3. **运行 Gate**（Terminal C）：

```bash
export TEST_TOKEN="<真实的 JWT token>"
export CE01_TEST_PROJECT_ID="<真实的 project UUID>"
export CE01_TEST_CHARACTER_ID="<真实的 character UUID>"

bash tools/gate/gates/gate-ce01_protocol_instantiation.sh 2>&1 | tee docs/_evidence/CE01_SEAL_20260110/gate_output.log
```

## 注意事项

- 如果 Worker 仍然要求 API Key，请检查 `.env.local` 或 `.env` 文件中的 `WORKER_API_KEY` 和 `WORKER_API_SECRET`
- 确保 `JOB_WORKER_ENABLED=true`（之前设置为 false 会导致 Worker 不处理任何 Job）
