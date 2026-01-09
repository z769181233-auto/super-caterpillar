# STAGE4_CLOSE_MVP_CHECKLIST

生成时间：2025-12-12  
适用范围：Stage4 Close-MVP（不扩展新功能）  
当前状态：代码链路已完成；本地 DB 不可达，未做真实数据写入；前后端均可编译通过。

---

## 1. 概要

- 目标：验证 Stage4（三引擎 + API + 前端面板）的最小可用链路，形成可签字的交付清单。
- 现状：后端 Engine Hub/Controller/Service 已接线；前端面板具备加载/错误/空态；DB 未连通，迁移未实际 apply。

## 2. 数据层

- 新增表（Prisma 模型，映射实际表名）
  - `SemanticEnhancement` → `semantic_enhancements`：nodeType/nodeId 唯一，data JSON，engineKey/engineVersion，confidence。
  - `ShotPlanning` → `shot_plannings`：shotId 唯一 FK shots(id)，data JSON，engineKey/engineVersion，confidence。
  - `StructureQualityReport` → `structure_quality_reports`：projectId 唯一 FK projects(id)，data JSON，engineKey/engineVersion。
- 迁移位置：`packages/database/prisma/migrations/20241212_stage4_semantic_shot_qa_tables/migration.sql`
- 环境状态：本地数据库不可达（P1001）；迁移文件已生成但未在当前环境 apply，需在可连库环境执行 `pnpm prisma migrate dev --name stage4_semantic_shot_qa_tables` 或部署环境 `prisma migrate deploy`。

## 3. Engine Hub & API

- Engine Key（全局一致）：`semantic_enhancement` / `shot_planning` / `structure_qa`
- 路由（Controller 定义）：
  - POST `/api/projects/:projectId/scenes/:sceneId/semantic-enhancement`
  - GET `/api/projects/:projectId/scenes/:sceneId/semantic-enhancement`
  - POST `/api/projects/:projectId/shots/:shotId/shot-planning`
  - GET `/api/projects/:projectId/shots/:shotId/shot-planning`
  - POST `/api/projects/:projectId/structure-quality/assess`
  - GET `/api/projects/:projectId/structure-quality/report`
- 调用链：Controller → Stage4Service → EngineInvokerHubService → Local Adapter (stub) → Prisma（upsert/find）。本地因无 DB，Prisma 访问封装 `as any` 以保证编译通过。

## 4. 前端

- 组件路径：
  - `components/studio/SemanticInfoPanel.tsx`（Scene）
  - `components/studio/ShotPlanningPanel.tsx`（Shot）
  - `components/studio/QualityHintPanel.tsx`（Project）
- 状态机（统一逻辑）：
  - 未选中：提示“请选择…”且不发请求。
  - 加载中：显示“加载中…”。
  - 错误：显示错误文案 + “重试”按钮（重新触发 GET）。
  - 空态：显示“暂无…”；有数据则展示 summary/keywords、shotType/movement、overallScore/issues。
- 页面挂载：`app/projects/[projectId]/page.tsx` 传入选中态 IDs；组件内部再防御未选中。

## 5. Security & Audit

- 守卫/权限：Stage4 Controller 顶层 `@UseGuards(JwtAuthGuard, PermissionsGuard)`；POST 需 `PROJECT_GENERATE`，GET 需 `PROJECT_READ`。
- 审计动作（Stage4Service.recordAudit 调用）：`SEMANTIC_ENHANCEMENT_RUN` / `SHOT_PLANNING_RUN` / `STRUCTURE_QA_RUN`；resourceType 分别为 scene / shot / project。
- HMAC/Nonce：未在本地真实环境验证签名/Nonce（需在有鉴权环境复测）。

## 6. Lint / Build 状态

- 执行命令（本轮）：
  - `pnpm --filter @scu/shared-types build`：通过。
  - `pnpm --filter api lint`：通过，存在大量历史 warning（全局 any/unused）；无 Stage4 新的 error。
  - `pnpm --filter api build`：通过。
  - `pnpm --filter web lint`：存在历史 warning（全局 any 等），无 Stage4 新 error。
  - `pnpm --filter web build`：通过。
- 新增阻断：无。Stage4 相关新增仅有非阻断的 lint warning（因 `any` 包装 Prisma stub）。

## 7. 已知限制 & 后续建议

- 限制：
  - DB 未连通：迁移未实际落库，API 仅静态编译验证。
  - 引擎实现为本地 stub，未接真实 HTTP 引擎。
  - 内容安全/水印/指纹/深度质量规则未启用。
  - HMAC/Nonce 未在真实环境实测。
- 建议后续步骤：
  1. 在可用 DB 环境执行迁移并跑一轮手动 POST/GET 验证三表写入。
  2. 接入真实 HTTP 引擎或完善本地适配器，补充字段校验。
  3. 在鉴权开启的环境复测 Jwt/HMAC/Nonce，并确认审计入库。
  4. 为三条 API 补最小契约/集成测试（可用 supertest + mock Prisma）。
  5. 结合 Stage4 后续计划：规则路由/多引擎对比/A-B 实验接续落地。

---

## 8. 真实验证记录（本轮 - 2025-12-12）

### A) 启动验证（AuditInterceptor DI 修复）

- **修复内容**：移除所有业务 Controller 中的局部 `@UseInterceptors(AuditInterceptor)`，仅保留 `AppModule` 中唯一的全局 `APP_INTERCEPTOR` 注册。
- **验证结果**：
  - `rg -n "AuditInterceptor|APP_INTERCEPTOR|UseInterceptors" apps/api/src` 结果：
    - `app.module.ts:49-50`：唯一 `APP_INTERCEPTOR` 注册
    - `audit.interceptor.ts`：类定义
    - `audit.module.ts`：providers/exports 声明
    - `project.controller.ts:276`：仅注释提及（无实际使用）
    - **无任何 `@UseInterceptors(AuditInterceptor)` 残留**
- **编译验证**：
  ```
  rm -rf apps/api/dist
  pnpm --filter api build
  ```
  结果：✅ webpack 5.97.1 compiled successfully in 3059 ms
- **API 进程状态**：`pnpm --filter api dev` 已在后台运行（进程 ID: 92016）
- **待确认**：需要检查 API 启动日志，确认 "Nest application successfully started" 或 "Listening on ..."

### B) DB 与迁移验证

- **迁移状态**：

  ```bash
  cd packages/database
  npx prisma migrate status
  ```

  结果：✅ 3 migrations found, Database schema is up to date!

  ```bash
  npx prisma migrate deploy
  ```

  结果：✅ No pending migrations to apply.

  ```bash
  npx prisma generate
  ```

  结果：✅ Generated Prisma Client (v5.22.0) in 229ms

- **表存在性验证**：
  ```bash
  docker exec super-caterpillar-db psql -U postgres -d super_caterpillar_dev -c "\dt"
  ```
  结果：✅ 48 张表，包含：
  - `semantic_enhancements` ✅
  - `shot_plannings` ✅
  - `structure_quality_reports` ✅

### C) audit_logs 表结构验证

```bash
docker exec super-caterpillar-db psql -U postgres -d super_caterpillar_dev -c "\d audit_logs"
```

结果：✅ 表结构包含以下字段（符合 DB Spec）：

- `id`, `userId`, `apiKeyId`, `action`, `resourceType`, `resourceId`
- `ip`, `userAgent`, `details` (jsonb)
- `createdAt`, `nonce`, `signature`, `timestamp` ✅（HMAC/Nonce 字段已存在）
- 索引：`audit_logs_nonce_timestamp_idx` ✅

**当前审计记录查询**：

```sql
SELECT action, "resourceType", "resourceId", "userId", "createdAt"
FROM audit_logs
WHERE action IN ('SEMANTIC_ENHANCEMENT_RUN','SHOT_PLANNING_RUN','STRUCTURE_QA_RUN')
ORDER BY "createdAt" DESC LIMIT 20;
```

结果：0 rows（正常，尚未调用 Stage4 API）

### D) Lint/Build 验证

- **API Lint**：

  ```bash
  pnpm --filter api lint
  ```

  结果：✅ 通过，仅有历史 warning（`@typescript-eslint/no-explicit-any`），无 Stage4 新 error

- **API Build**：

  ```bash
  pnpm --filter api build
  ```

  结果：✅ webpack 5.97.1 compiled successfully in 3059 ms

- **Web Lint**：

  ```bash
  pnpm --filter web lint
  ```

  结果：✅ 通过，仅有历史 warning（`@typescript-eslint/no-explicit-any`），无 Stage4 新 error

- **Web Build**：
  ```bash
  pnpm --filter web build
  ```
  结果：✅ 构建成功，所有路由正常生成

### E) 待执行（需要用户提供环境变量）

1. **API 启动日志验证**：需要检查 `pnpm --filter api dev` 的完整启动日志，确认 "Nest application successfully started" 或 "Listening on ..."
2. **6 条 Stage4 路由 JWT 调用**：需要提供以下环境变量：
   - `API_BASE_URL`（通常 http://localhost:3000 或实际端口）
   - `JWT_TOKEN`（具备 PROJECT_READ/PROJECT_GENERATE 权限）
   - `LOW_JWT_TOKEN`（低权限，用于验证 401/403）
   - `PROJECT_ID`, `SCENE_ID`, `SHOT_ID`（真实项目数据）
3. **HMAC/Nonce 重放测试**：需要提供：
   - `WORKER_ID`
   - `HMAC_APIKEY`
   - `HMAC_SECRET`
4. **审计落库核验**：调用 Stage4 API 后，查询 `audit_logs` 表确认三类 action 记录

### F) 当前阻断点

- ⏳ **API 启动日志未确认**：需要检查实际启动日志，确认无 DI 错误
- ⏳ **Stage4 API 调用未执行**：需要用户提供 JWT_TOKEN 等环境变量
- ⏳ **HMAC/Nonce 重放测试未执行**：需要用户提供 HMAC 相关环境变量

## 9. 待执行（下次需完成的步骤与证据）

1. 启动数据库：解决 Docker daemon 问题或提供外部 `DATABASE_URL`/`REDIS_URL`，确保 5432/6379 可连。
2. 迁移：
   - `pnpm -r --filter database prisma migrate status`
   - `cd packages/database && pnpm prisma migrate deploy`
3. 表验证：`\dt` 列表中确认 Stage4 三表真实表名；如有差异写入本文件。
4. 六接口（JWT）：3 GET + 3 POST，记录请求/状态码/关键字段。
5. 鉴权失败：低权限 JWT 调用至少 1 条返回 401/403。
6. HMAC/Nonce：`POST /api/workers/{workerId}/jobs/next`（Headers: X-SCU-APIKEY/X-SCU-NONCE/X-SCU-TIMESTAMP/X-SCU-SIGNATURE/Content-Type），合法一次成功；同 nonce 重放应被拒绝。
7. 审计查询：
   - `\d audit_logs`
   - `SELECT action, resource_type, resource_id, user_id, created_at FROM audit_logs WHERE action IN ('SEMANTIC_ENHANCEMENT_RUN','SHOT_PLANNING_RUN','STRUCTURE_QA_RUN') ORDER BY created_at DESC LIMIT 10;`
8. Lint/Build：`pnpm --filter api lint && pnpm --filter api build && pnpm --filter web lint && pnpm --filter web build`，确认无 Stage4 新 error。
9. 将以上命令输出/状态码/SQL 结果写入本文件的“真实验证”章节，并注明任何阻断点。
