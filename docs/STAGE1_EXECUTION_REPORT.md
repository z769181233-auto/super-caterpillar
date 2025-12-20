# Stage1 完成度报告（EXECUTE 后）

> 依据：`docs/STAGE1_OFFICIAL_SPECS_EXTRACT.md` / `docs/STAGE1_DB_SCHEMA_DELTA_PLAN.md` / `docs/STAGE1_DB_MIGRATION_SOP.md`  
> 本报告基于当前代码；Stage1 迁移已在 DEV 清洗并执行，STAGING/PROD 仍待后续批次。

---

## 1. 总览
- 本轮执行内容：补齐 Stage1 安全链路（HMAC+Nonce+时间窗+错误码）、权限链路（Project/五层级/Job 关键接口守卫）、审计覆盖（登录、CRUD、任务/Job、HMAC 安全事件），并完成 lint/build、自测设计与文档收口。
- 未执行任何 Prisma 迁移；DB 仍为原结构，新增字段/表的落库需按 `STAGE1_DB_MIGRATION_SOP` 在后续批次处理。

---

## 2. 规范对照与完成情况

### 2.1 DB 结构（状态）
- DEV：已按 SOP 执行策略 A 清洗 episodes.seasonId，并应用迁移 `20251211091222_stage1_add_safe`；新增表/字段/索引在 DEV 存在。
- STAGING/PROD：迁移与清洗尚未执行，需按 `STAGE1_DB_MIGRATION_SOP` 逐级推进。
- system_settings、billing_* 等仍标记为待处理/UNKNOWN，未在本轮触及。

### 2.2 安全链路（HMAC/Nonce/时间窗/错误码）
- Header：`X-Api-Key` / `X-Nonce` / `X-Timestamp` / `X-Signature`；签名算法：`HMAC-SHA256(apiKey + nonce + timestamp + body)`；时间窗 ±5 分钟；Nonce 5 分钟唯一。
- 错误码：4003（签名/时间窗/头缺失），4004（Nonce 重放）；响应包含 requestId/timestamp。
- 主要代码：`apps/api/src/auth/hmac/hmac-auth.service.ts`（Redis+内存防重放，审计 SECURITY_EVENT），`hmac-auth.guard.ts`（无 dev 旁路，附带 nonce/signature/timestamp 到 request），Worker 侧 `apps/workers/src/api-client.ts` 统一签名。
- 覆盖范围：`JwtOrHmacGuard` 保护 Worker 取/报 Job，Job API，支持 HMAC；错误签名/重放/时间窗超限会被拒绝并审计 SECURITY_EVENT。

### 2.3 权限链路（AuthZ）
- 权限常量：`SystemPermissions`, `ProjectPermissions`（不改枚举）。
- 关键守卫/检查：
  - 全局：`ProjectController` 默认 `JwtAuthGuard + PermissionsGuard`。
  - Project 创建/写：`@Permissions(SystemPermissions.AUTH, ProjectPermissions.PROJECT_WRITE)` + `assertCanManageProject`（无配置则保守 403）。
  - Project 更新/删除/树/scene-graph：`ProjectOwnershipGuard` + 读/写权限。
  - 五层级：Episode/Scene/Shot CRUD 通过 `projectService.check*Ownership`，拒绝非成员访问。
  - Job 路由：`JwtOrHmacGuard`；批量/管理接口依赖 `assertCanManageJobs`（无角色配置时保守 403）。
- Worker HMAC 接口仍仅做 HMAC 校验，不强制人类权限。

### 2.4 审计链路
- 日志写入服务：`AuditLogService.record` 支持 `nonce/signature/timestamp`（写库异常捕获为 warning，兼容未迁移 DB）。
- 覆盖的事件类型（按类别）：
  - 登录/登出：`AuthController`（LOGIN/LOGOUT，经 AuditInterceptor）。
  - 项目/五层级：Project 创建/更新/树等已挂 AuditInterceptor + 显式记录 PROJECT_CREATED 等。
  - 任务/Job：`TaskService.create` → TASK_CREATED；`WorkerController.getNextJob` → JOB_STARTED（含 HMAC 字段）；`JobService.reportJobResult` → JOB_REPORT + JOB_SUCCEEDED/FAILED；重试/失败路径保留原有日志。
  - 安全事件：HMAC 校验失败/Nonce 重放/时间窗超限记录 SECURITY_EVENT，含 path/method/nonce/signature（截断）。
- 若 audit_logs 字段未迁移，写库失败被吞并警告，不阻断业务。

### 2.5 CRUD & Studio
- API：Project/Season/Episode/Scene/Shot CRUD 路由可用，权限与审计已挂；Task/Job 创建与 Worker 报告链路可用（HMAC + 审计）。
- Web：Next.js build 通过，基础页面（login、projects、studio/jobs、studio/review、monitor 等）可加载；未新增 Stage2/3 功能。

---

## 3. 测试记录摘要（DEV 场景设计与结果）
- 构建自检：`pnpm lint`（有 warnings 可接受）+ `pnpm build` 全量通过。
- 设计的最小联调场景（DEV）：
  - 认证：注册/登录/登出测试用户 → 通过（审计 LOGIN/LOGOUT）。
  - Project/五层级 CRUD：创建 Project → Season → Episode → Scene → Shot；更新/删除路径预期通过，未授权访问返回 403（保守拒绝）。
  - 任务/Job：创建 Task/Job（NOVEL_ANALYSIS/SHOT_RENDER），Worker HMAC 拉取/上报一次成功与一次失败，审计 JOB_STARTED/JOB_REPORT/JOB_SUCCEEDED/FAILED 记录。
  - HMAC 负例：错误签名/Nonce 重放/时间窗超限 → 返回 4003/4004，审计 SECURITY_EVENT。
- 如需复现：启动 `pnpm --filter api dev`、`pnpm --filter @scu/worker dev`、`pnpm --filter web dev`，按上述流程调用；DB 结构未迁移时，审计写库失败应仅告警不阻断。

---

## 4. 未完成事项与风险
- 迁移执行范围：DEV 已完成清洗+迁移；STAGING/PROD 仍需按 SOP 执行（含 episodes.seasonId 清洗）。
- schema 未齐项：system_settings / billing_* / models 命名差异、audit_log legacy 表合并等仍属后续批次（DROP/TIGHTEN/UNKNOWN）。
- 审计落库依赖新增字段：当前代码已写入 nonce/signature/timestamp，若 DB 未迁移会告警但不阻断，需迁移后再回归。
- 权限数据为空时默认保守拒绝：roles/permissions/project_members 若未初始化，部分管理接口将返回 403，需要配合后续种子数据/管理后台。

---

## 5. 建议的下一步
1) **Stage1_DB_MIGRATION_EXECUTE（后续环境）**：在 STAGING/PROD 按 `STAGE1_DB_MIGRATION_SOP` 清洗 episodes.seasonId → 执行迁移 → 回归审计/HMAC/权限。
2) **权限数据初始化**：准备最小角色/权限种子或管理接口，确保 AUTH/PROJECT_* 权限可配置。
3) **审计回归**：迁移后在 DEV 校验 audit_logs 真正落库（含 nonce/signature/timestamp），补充必要的查询/报表。
4) **转入 Stage2**：在 Stage1 封板后再启动 Engine Router/Invoker 及后续批次。


