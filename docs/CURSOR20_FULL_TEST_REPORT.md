# Cursor20 完整测试报告

**生成时间**: 2025-12-15 11:58:33
**测试范围**: 仓库级静态检查 + Smoke 契约验收

---

## 1. 环境状态

### 1.1 Docker 容器状态

```
NAMES                     STATUS        PORTS
scu-postgres              Up 36 hours   0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp
super-caterpillar-redis   Up 2 days     0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
super-caterpillar-minio   Up 2 days     0.0.0.0:9000-9001->9000-9001/tcp, [::]:9000-9001->9000-9001/tcp
super-caterpillar-db      Up 2 days     0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp

```

### 1.2 3000 端口监听情况

```
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    65592 adam   22u  IPv6 0x850d01766a2d2b9f      0t0  TCP *:3000 (LISTEN)

```

### 1.3 API 启动状态

- **日志文件**: `/tmp/api_dev_fulltest.log`
- **状态**: ✅ API 启动成功

---

## 2. 检查结果总览表

| 检查项    | 状态         | 失败条目数   | 日志文件                  |
| --------- | ------------ | ------------ | ------------------------- |
| Typecheck | ✅ PASS      | 0            | `/tmp/test_typecheck.log` |
| Lint      | ✅ PASS      | 674 warnings | `/tmp/test_lint.log`      |
| Unit Test | ⚠️ NOT FOUND | -            | -                         |
| Smoke     | ❌ FAIL      | 1            | `/tmp/test_smoke.log`     |

---

## 3. 失败点明细

### 3.1 阻塞启动 (BLOCKER_STARTUP)

无阻塞启动问题

### 3.2 编译错误 (COMPILE)

无编译错误

### 3.3 运行时错误 (RUNTIME)

无运行时错误

### 3.4 契约不匹配 (CONTRACT)

无契约不匹配问题

### 3.5 环境依赖 (ENV)

#### 失败点 1: 数据库迁移失败: P3009 - 存在失败的迁移记录

- **分类**: ENV
- **触发命令**: `bash tools/smoke/run_all.sh`
- **日志文件**: /tmp/test_smoke.log
- **错误摘要**: 数据库迁移失败: P3009 - 存在失败的迁移记录
- **关键错误**:

```
Error: P3009
```

- **涉及文件**: packages/database/prisma/migrations
- **修复优先级**: P0
- **建议修复方向**: 解决数据库迁移失败问题：检查 `20241212_stage4_semantic_shot_qa_tables` 迁移状态，使用 `prisma migrate resolve` 标记为已应用或回滚

## 4. 修复队列

### P0: 阻塞 API 启动 + 核心契约端点

1. [ENV] 数据库迁移失败: P3009 - 存在失败的迁移记录 - 解决数据库迁移失败问题：检查 `20241212_stage4_semantic_shot_qa_tables` 迁移状态，使用 `prisma migrate resolve` 标记为已应用或回滚

### P1: Smoke 剩余问题

无 P1 问题

### P2: Lint/边角问题

无 P2 问题（Lint 有 536 个 warnings，但不阻塞）

## 5. 日志文件尾部

### 5.1 API 启动日志（末尾 80 行）

```
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/jobs/:id/report, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"TaskGraphController {/api/tasks}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/tasks/:taskId/graph, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"EngineController {/api/engines}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/engines, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"EngineAdminController {/api/admin/engines}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/public, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key, PATCH} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key, DELETE} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key/versions, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key/versions, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key/versions/:versionName, PATCH} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key/versions/:versionName, DELETE} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/admin/engines/:key/default-version, PATCH} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"WorkerController {/api/workers}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/workers/register, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/workers/:workerId/heartbeat, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/workers/online, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/workers/:workerId/jobs/next, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"WorkerMonitorController {/api/workers/monitor}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/workers/monitor/stats, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"WorkerAliasController {/api/api/workers}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/api/workers, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/api/workers/:workerId/heartbeat, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/api/workers/:workerId/jobs/next, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"OrchestratorController {/api/orchestrator}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/orchestrator/dispatch, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/orchestrator/stats, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"OrchestratorMonitorController {/api/orchestrator/monitor}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/orchestrator/monitor/stats, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"AutofillController {/api/autofill}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"NovelImportController {/api/projects/:projectId/novel}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/novel/import-file, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/novel/import, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/novel/jobs, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/novel/analyze, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"EngineProfileController {/api/engine-profile}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/engine-profile/summary, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"Stage4Controller {/api/projects/:projectId}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/scenes/:sceneId/semantic-enhancement, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/scenes/:sceneId/semantic-enhancement, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/shots/:shotId/shot-planning, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/shots/:shotId/shot-planning, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/structure-quality/assess, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/projects/:projectId/structure-quality/report, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"InternalController {/api/_internal}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/_internal/hmac-ping, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"StoryController {/api/story}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/story/parse, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"TextController {/api/text}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/text/visual-density, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/text/enrich, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"AssetController {/api/assets}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/assets/:assetId/secure-url, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/assets/:assetId/hls, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/assets/:assetId/watermark, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"MemoryController {/api/memory}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/memory/short-term/:chapterId, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/memory/long-term/:entityId, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/memory/update, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"ShotDirectorController {/api/shots}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/shots/:shotId/inpaint, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/shots/:shotId/pose, POST} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RoutesResolver","msg":"HealthController {/api}:"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/health, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/health/live, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/health/ready, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/health/gpu, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/ping, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/metrics, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/api/health/ready, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/api/health/live, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RouterExplorer","msg":"Mapped {/api/api/health/gpu, GET} route"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RedisService","msg":"Connecting to Redis: redis://localhost:6379"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RedisService","msg":"Redis connected"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"RedisService","msg":"Redis service initialized"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"JobWorkerService","msg":"Job Worker enabled, starting with interval 5000ms"}
{"level":30,"time":1765774525232,"pid":65592,"hostname":"AdamdeMacBook-Pro.local","context":"NestApplication","msg":"Nest application successfully started"}

```

### 5.2 Typecheck 日志（末尾 80 行）

```

> super-caterpillar-universe@1.0.0 typecheck
> turbo run typecheck

turbo 2.6.3

• Packages in scope: @scu/shared-types, @scu/worker, api, config, database, web
• Running typecheck in 6 packages
• Remote caching disabled
config:build: cache hit, replaying logs 6b6453e70fa12c28
config:build:
config:build: > config@1.0.0 build packages/config
config:build: > tsc
config:build:
@scu/shared-types:build: cache hit, replaying logs 7bb19518b059ef4d
@scu/shared-types:build:
@scu/shared-types:build: > @scu/shared-types@1.0.0 build packages/shared-types
@scu/shared-types:build: > tsc -p tsconfig.build.json
@scu/shared-types:build:
database:build: cache hit, replaying logs 447c54f0d577adcb
database:build:
database:build: > database@1.0.0 build packages/database
database:build: > tsc -p tsconfig.json && cp -r src/generated dist/
database:build:
api:typecheck: cache hit, replaying logs 68f7b56f9a16f032
api:typecheck:
api:typecheck: > api@1.0.0 typecheck apps/api
api:typecheck: > tsc -p tsconfig.json --noEmit
api:typecheck:

 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    196ms >>> FULL TURBO


```

### 5.3 Lint 日志（末尾 80 行）

```
api:lint:    4:10  warning  'Prisma' is defined but never used               @typescript-eslint/no-unused-vars
api:lint:   29:15  warning  Unexpected any. Specify a different type         @typescript-eslint/no-explicit-any
api:lint:   83:15  warning  Unexpected any. Specify a different type         @typescript-eslint/no-explicit-any
api:lint:   85:14  warning  Unexpected any. Specify a different type         @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/src/text/text.controller.ts
api:lint:   39:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   40:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   66:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   67:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/src/user/user.controller.ts
api:lint:   22:74  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   47:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   77:68  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/src/user/user.service.ts
api:lint:    8:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   14:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   37:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/src/worker/dto/heartbeat.dto.ts
api:lint:   1:10  warning  'IsString' is defined but never used  @typescript-eslint/no-unused-vars
api:lint:
api:lint: apps/api/src/worker/worker-alias.controller.ts
api:lint:    35:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    37:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    77:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    79:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   110:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   124:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   125:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   126:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   127:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/src/worker/worker.controller.ts
api:lint:    30:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    32:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    73:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    75:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   125:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   139:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   140:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   141:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   142:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/src/worker/worker.service.ts
api:lint:    31:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    51:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:    64:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   148:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   199:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   209:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   210:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   216:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   217:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   254:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   298:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   443:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   478:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   493:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   501:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: apps/api/test/contract/hmac-nonce.e2e-spec.ts
api:lint:   18:9   warning  'API_SECRET' is assigned a value but never used     @typescript-eslint/no-unused-vars
api:lint:   87:13  warning  'firstResponse' is assigned a value but never used  @typescript-eslint/no-unused-vars
api:lint:
api:lint: apps/api/test/hmac-security.e2e-spec.ts
api:lint:   102:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   133:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   194:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:   236:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
api:lint:
api:lint: ✖ 536 problems (0 errors, 536 warnings)
api:lint:

 Tasks:    5 successful, 5 total
Cached:    5 cached, 5 total
  Time:    145ms >>> FULL TURBO


```

### 5.4 Smoke 日志（末尾 80 行）

```
0. Verify sources...
[verify] root=
[verify] entry=tools/smoke/stage1_stage2_smoke.ts
[verify] expected:
[verify]   tools/smoke/helpers/health_check.ts
[verify]   tools/smoke/helpers/hmac_request.ts
[verify]   tools/smoke/helpers/response_body.ts
[verify] unique file check...
[verify] unique markers...
[verify] entry import constraints...
[verify] OK
[smoke] DB mode=migrate
[smoke] Applying migrations (deploy)...
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "scu", schema "public" at "localhost:5433"

3 migrations found in prisma/migrations

Error: P3009

migrate found failed migrations in the target database, new migrations will not be applied. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve
The `20241212_stage4_semantic_shot_qa_tables` migration started at 2025-12-15 04:13:54.978819 UTC failed



```
