# Worker 体系修复总结

## 修复目标
修复 Worker 体系，使其能够：
1. 通过 `pnpm dev` 启动
2. 与 Orchestrator 联调
3. 通过 `e2e:novel:worker` 测试

## 修复内容

### 1. apps/workers/package.json
- ✅ 添加 `database` workspace 依赖（用于 Prisma Client）
- ✅ 添加 `config` workspace 依赖（用于环境变量）
- ✅ 修改 `dev` 脚本为 `ts-node -r tsconfig-paths/register src/main.ts`
- ✅ 添加 `ts-node`、`tsconfig-paths`、`@types/node` 到 devDependencies

### 2. apps/workers/tsconfig.json
- ✅ 移除 `rootDir` 限制（允许导入 workspace 包）
- ✅ 添加 `paths` 配置：`config` 和 `database`
- ✅ 配置 `ts-node` 使用 `tsconfig-paths/register`

### 3. apps/workers/src/env.ts
- ✅ 改为复用 `packages/config/src/env.ts` 的 `env` 对象
- ✅ 扩展 Worker 特定配置（apiUrl, workerId, apiKey, apiSecret 等）

### 4. apps/workers/src/main.ts（新建）
- ✅ Worker 主入口文件
- ✅ 连接数据库（使用 Prisma Client）
- ✅ 注册 Worker 节点（通过 API）
- ✅ 启动心跳循环（每 5 秒）
- ✅ 启动 Job 轮询循环（可配置间隔）
- ✅ 处理 NOVEL_ANALYSIS 类型的 Job
- ✅ 上报 Job 结果
- ✅ 优雅退出处理

### 5. apps/workers/src/novel-analysis-processor.ts
- ✅ 更新注释：处理 NOVEL_ANALYSIS 类型（而非 NOVEL_ANALYZE_CHAPTER）
- ✅ 改进日志输出
- ✅ 返回更详细的结果

### 6. apps/api/src/orchestrator/orchestrator.service.ts
- ✅ 修复 dispatch 逻辑：分配 Worker 时保持 PENDING 状态（Worker 拉取时再设置为 RUNNING）
- ✅ 修复返回值：添加 `skipped` 和 `errors` 字段

### 7. apps/api/src/scripts/e2e-novel-worker-pipeline.ts
- ✅ 修复返回值访问：使用可选链操作符访问 `skipped` 和 `errors`

## 关键修复点

### Orchestrator 与 Worker 的状态同步
**问题**：Orchestrator 在 dispatch 时将 Job 状态直接设置为 `RUNNING`，但 Worker 查找的是 `PENDING` 状态的 Job。

**修复**：Orchestrator 分配 Worker 时保持 `PENDING` 状态，Worker 拉取时再设置为 `RUNNING`。

### 环境变量复用
**问题**：Worker 自己实现了 dotenv 加载逻辑，与 API 不一致。

**修复**：Worker 复用 `packages/config/src/env.ts`，确保使用相同的环境变量配置。

### Job 类型一致性
**问题**：E2E 脚本和 Worker 使用的 Job 类型可能不一致。

**修复**：
- E2E 脚本创建 `JobType.NOVEL_ANALYSIS` 类型的 Job
- Worker 处理 `NOVEL_ANALYSIS` 类型的 Job
- 两者保持一致

## 验证步骤

### 1. 检查数据库
```bash
docker ps | grep postgres
```

### 2. 启动 API（终端 1）
```bash
cd apps/api
pnpm start:dev
```

### 3. 启动 Worker（终端 2）
```bash
cd apps/workers
pnpm dev
```

### 4. 运行 E2E 测试（终端 3）
```bash
cd 仓库根目录
pnpm --filter api e2e:novel:worker
```

## 预期结果

### Worker 启动日志
```
========================================
Super Caterpillar Worker
========================================

[Worker] 正在连接数据库...
[Worker] ✅ 数据库连接成功
[Worker] 正在注册 Worker 节点...
[Worker] Worker ID: local-worker
[Worker] Worker Name: local-worker
[Worker] API URL: http://localhost:3000
[Worker] Database URL: 已配置
[Worker] API Key: ak_worker_dev_0000000...
[Worker] API Secret: 已配置
[Worker] ✅ Worker 注册成功

[Worker] ✅ Worker 启动成功
[Worker] 心跳间隔: 5 秒
[Worker] Job 轮询间隔: 2000ms
[Worker] Job Worker 启用状态: 已启用
```

### E2E 测试输出
```
========================================
E2E 测试：真实 Worker 联调版（小说 → 分析 → 结构生成）
========================================

[E2E] 步骤 1: 创建或获取测试用户和组织...
[E2E] 步骤 2: 创建或获取测试项目...
[E2E] 步骤 3: 导入小说...
[E2E] ✅ 创建了 X 个 Job
[E2E] 等待 3 秒让系统初始化...
[E2E] 步骤 4: 触发 Orchestrator 调度...
[E2E] ✅ Orchestrator 调度完成: dispatched=X, skipped=0, errors=0
[E2E] 步骤 5: 等待真实 Worker 处理 Job...
[E2E] Job 状态: PENDING=0, RUNNING=0, SUCCEEDED=X, FAILED=0, RETRYING=0
[E2E] ✅ 所有 Job 已由真实 Worker 处理完成
[E2E] 步骤 6: 验证生成的结构...
[E2E] ✅ 结构验证通过

========================================
✅ E2E 测试通过（真实 Worker 联调版）！
========================================
```

## 注意事项

1. **环境变量**：确保根目录 `.env` 文件包含：
   - `DATABASE_URL`
   - `WORKER_API_KEY`
   - `WORKER_API_SECRET`
   - `WORKER_ID`（可选，默认 `local-worker`）
   - `JOB_WORKER_ENABLED=true`（可选，默认 false）

2. **数据库迁移**：确保数据库已运行最新迁移，包含 `worker_nodes` 表。

3. **API Key 初始化**：首次运行前，执行：
   ```bash
   pnpm --filter api init:worker-api-key
   ```

4. **Worker 注册**：Worker 启动时会自动通过 API 注册，无需手动操作。

