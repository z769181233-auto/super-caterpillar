# Super Caterpillar V1 开发快速上手指南

## 简介

本指南旨在帮助新开发者在本地环境中快速启动 Super Caterpillar V1 骨架，并完成一次端到端的验证流程。

**重要说明：**

- 本指南只解决"如何在本地跑起来 + 做一次完整自检"
- 不涉及架构设计、商业逻辑等深度内容
- 所有命令基于当前 V1 骨架的实际结构

---

## 环境要求

### 必需环境

- **Node.js**: >= 20.x（推荐使用 LTS 版本）
- **pnpm**: 9.1.0（项目使用 `packageManager: "pnpm@9.1.0"`）
- **PostgreSQL**: 15+（本地安装或 Docker 均可）

### 端口约定

- **API**: `3000`
- **Web**: `3001`
- **PostgreSQL**: `5432`（默认）

### PostgreSQL 准备

#### 方式一：Docker（推荐）

```bash
# 启动 PostgreSQL 容器
docker run -d --name super-caterpillar-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15

# 创建数据库
docker exec -it super-caterpillar-postgres psql -U postgres -c "CREATE DATABASE super_caterpillar_dev;"
```

#### 方式二：本地 PostgreSQL

```bash
# 创建数据库（macOS/Linux）
createdb super_caterpillar_dev

# 或使用 psql
psql -U postgres -c "CREATE DATABASE super_caterpillar_dev;"
```

---

## 一次性初始化步骤

### 1. 克隆仓库

```bash
git clone <你的仓库地址>
cd "Super Caterpillar"  # 或你的实际目录名
```

### 2. 安装依赖

```bash
pnpm install
```

预期输出：`Done in X.Xs`，无错误。

### 3. 环境变量配置（可选）

本地开发可以直接通过命令行传递环境变量，无需创建 `.env` 文件。

如果需要使用 `.env` 文件，可在项目根目录创建 `.env`，示例：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public
NODE_ENV=development
```

### 4. Prisma 初始化

```bash
pnpm --filter database prisma:generate
```

预期输出：

```
✔ Generated Prisma Client (v5.22.0) to ./../node_modules/.prisma/client in XXXms
```

**注意：** V1 阶段可暂时不执行 `prisma migrate` 或忽略迁移错误，只要数据库连接正常即可。

---

## 常规开发启动流程（三终端）

### 终端 1：启动 API

```bash
cd ""  # 替换为你的实际路径

JOB_WORKER_ENABLED=false \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api dev
```

**正常启动标志：**

- 日志中出现：`🚀 API Server is running on: http://localhost:3000`
- 无 `EADDRINUSE` 错误
- 可以通过 `curl http://localhost:3000/api/health` 验证（返回 `{"status":"healthy"}`）

### 终端 2：启动 Worker

```bash
cd ""  # 替换为你的实际路径

API_URL=http://localhost:3000 \
WORKER_API_KEY=ak_worker_dev_0000000000000000 \
WORKER_API_SECRET=super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678 \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter @scu/worker dev
```

**正常启动标志：**

- 日志中出现：`✅ Worker 注册成功`
- 日志中出现：`✅ Worker 启动成功`
- 定期输出心跳日志：`[Worker HMAC_V2] POST /api/workers/heartbeat`
- 定期输出 Job 轮询日志：`[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next`
- 没有 Job 时可能输出：`[DEV][Job] getNextPendingJobForWorker ... jobId=none ...`

### 终端 3：启动 Web

```bash
cd ""  # 替换为你的实际路径

pnpm --filter ./apps/web dev
```

**正常启动标志：**

- Next.js 编译成功：`✓ Ready in XXXXms`
- 日志显示：`- Local: http://localhost:3001`
- 浏览器访问 `http://localhost:3001` 能看到页面（即使显示"加载中..."也算正常）

---

## 最小端到端验证流程（四步走）

### 步骤 1：创建测试 Job（NOVEL_ANALYSIS）

在**新终端**（终端 4）中执行：

```bash
cd ""  # 替换为你的实际路径

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api create:test-novel-job
```

**预期输出：**

```
[create-test-novel-job] created job: {
  id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  status: 'PENDING',
  type: 'NOVEL_ANALYSIS',
  projectId: '...',
  shotId: '...'
}
```

**重要：** 命令执行完毕后会自动退出，不会长时间卡住（已修复脚本退出行为）。

### 步骤 2：观察 Worker 日志（终端 2）

在 Worker 终端中，你应该能看到类似日志：

```
[Worker] 开始处理 Job: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (type: NOVEL_ANALYSIS)
[Worker] ✅ Job xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx 处理成功
```

如果启用了 dev-only 日志，还会看到：

```
[DEV][Job] reportJobResult jobId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx status=SUCCEEDED workerId=...
```

**预期时间：** Job 处理通常在 1-2 秒内完成（当前为 Mock 实现）。

### 步骤 3：验证 Job 状态（终端 4）

```bash
cd ""  # 替换为你的实际路径

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api debug:jobs
```

**预期输出：**

- 至少看到一条 `type: 'NOVEL_ANALYSIS'`、`status: 'SUCCEEDED'` 的 Job
- 可以通过数据库查询验证 `payload.result` 中包含：
  - `type: 'NOVEL_ANALYSIS'`
  - `chapterId`
  - `projectId`
  - `shotId`
  - `processedAt`
  - `message: 'Novel analysis job processed successfully (minimal implementation)'`

### 步骤 4：打开 Web /projects 页面

在浏览器中访问：

```
http://localhost:3001/projects
```

**预期结果：**

- **没有项目时：** 页面正常显示，左侧显示"加载中..."或空列表文案，右侧显示"选择一个项目开始工作"，**不报错**
- **有项目时：** 左侧显示项目列表卡片（包含项目名称、ID、创建时间等信息）

**验证要点：**

- 页面能正常加载（无白屏、无控制台错误）
- UI 结构完整（有标题栏、侧边栏、主内容区）

---

## 常见问题（FAQ）

### 1. Prisma 类型错误 / lint 报错

**现象：** IDE 或 lint 工具报 Prisma Client 类型相关错误。

**原因：** V1 阶段已知，有一些 Prisma Client 类型相关的 lint 报警。

**解决：** 不影响核心流程，可暂时忽略。确保已执行 `pnpm --filter database prisma:generate`。

### 2. 端口占用

**现象：** API 启动时报 `Error: listen EADDRINUSE: address already in use :::3000`

**解决：**

```bash
# 查找占用端口的进程
lsof -i :3000

# 终止进程（替换 <PID> 为实际进程 ID）
kill -9 <PID>

# 或一键清理
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### 3. Worker 401 报错

**现象：** Worker 日志中出现 `401 Unauthorized` 错误。

**检查项：**

1. 确认 `WORKER_API_KEY` 和 `WORKER_API_SECRET` 与 API 配置一致
2. 确认 API 已正常启动（`http://localhost:3000/api/health` 可访问）
3. 开发环境下，`/api/workers/:workerId/jobs/next` 和 `/api/jobs/:id/report` 已配置 HMAC 旁路，若仍报错，检查 `NODE_ENV=development`

### 4. 脚本执行后不退出

**现象：** `create:test-novel-job`、`debug:jobs` 等脚本执行完后终端卡住。

**解决：** 此问题已在 STAGE 5 修复，脚本会自动退出。如果仍遇到，检查脚本是否已更新到最新版本。

### 5. Web 页面显示"加载中..."但无数据

**可能原因：**

- API 未启动或无法访问
- 浏览器控制台可能有 CORS 或网络错误
- 需要登录认证（当前 V1 阶段可能未实现完整鉴权流程）

**排查：**

- 检查 API 是否正常运行：`curl http://localhost:3000/api/health`
- 检查浏览器控制台（F12）是否有错误信息

---

## 附录：常用命令速查表

### 依赖与构建

```bash
# 安装依赖
pnpm install

# Prisma 生成 Client
pnpm --filter database prisma:generate

# API 构建
pnpm --filter ./apps/api build
```

### 启动服务

```bash
# 启动 API
JOB_WORKER_ENABLED=false \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api dev

# 启动 Worker
API_URL=http://localhost:3000 \
WORKER_API_KEY=ak_worker_dev_0000000000000000 \
WORKER_API_SECRET=super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678 \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter @scu/worker dev

# 启动 Web
pnpm --filter ./apps/web dev
```

### Job 管理脚本

```bash
# 创建测试 NOVEL_ANALYSIS Job
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api create:test-novel-job

# 查看最近的 NOVEL_ANALYSIS Job
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api debug:jobs

# 重置所有 NOVEL_ANALYSIS Job 为 PENDING
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/super_caterpillar_dev?schema=public" \
pnpm --filter ./apps/api reset:test-jobs
```

### 健康检查

```bash
# API 健康检查
curl http://localhost:3000/api/health

# Web 页面检查
curl http://localhost:3001/projects
```

---

## 下一步

完成上述验证后，你已经成功运行了 Super Caterpillar V1 骨架的核心功能：

- ✅ API 服务正常运行
- ✅ Worker 能够拉取并处理 Job
- ✅ Job 状态从 PENDING → RUNNING → SUCCEEDED 的完整流程
- ✅ Web 页面正常显示

如需深入了解架构设计、API 接口、数据库模型等，请参考项目中的其他文档（如 `docs/` 目录下的其他 `.md` 文件）。

---

**文档版本：** V1  
**最后更新：** 2025-12-09  
**维护者：** Super Caterpillar Team
