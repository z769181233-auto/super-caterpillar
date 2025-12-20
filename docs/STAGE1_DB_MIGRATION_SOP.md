# Stage1 DB Migration SOP（PLAN-only）

**适用范围**
- 迁移版本：`20251211091222_stage1_add_safe`（packages/database/prisma/migrations）
- 规范来源：`docs/STAGE1_OFFICIAL_SPECS_EXTRACT.md`、`docs/STAGE1_DB_SCHEMA_DELTA_PLAN.md`
- 本文档仅为**操作手册与检查/清洗方案**，**禁止视为已执行**，所有命令/SQL 仅为“建议模板”。

> 本 SOP 在 MODE: PLAN_ONLY_FOR_STAGE1_DB_MIGRATION_SOP 下生成：不得在同一批次中执行任何 `migrate dev/deploy` 或手工 DDL/DML。

---

## 1. 变更项清单（按 migration.sql 拆解）

### 1.1 已有表的字段变更

- `audit_logs`
  - 新增字段：
    - `nonce` TEXT NULL
    - `signature` TEXT NULL
    - `timestamp` TIMESTAMP(3) NULL
  - 新增索引：
    - `audit_logs_nonce_timestamp_idx` ON `audit_logs(nonce, timestamp)`
  - 数据影响：新增可空字段与索引，**对现有数据无破坏性影响**。

- `episodes`
  - 变更：
    - `ALTER TABLE "episodes" ALTER COLUMN "seasonId" SET NOT NULL;`
  - 数据影响：
    - Prisma 警告：已有 `seasonId IS NULL` 的记录（当前环境 472 行），**直接执行将失败或导致数据不符合约束**。
    - 该变更不属于“ADD_SAFE”，需要专门清洗策略（见第 3 章、第 4 章）。

- `scenes`
  - 新增字段：
    - `characters` JSONB NULL
    - `enrichedText` TEXT NULL
    - `projectId` TEXT NULL
    - `visualDensityScore` DOUBLE PRECISION NULL
  - 新增索引：
    - `scenes_projectId_index_idx` ON `scenes(projectId, index)`
  - 数据影响：字段可空 + 新索引，对现有数据无破坏性影响。

- `shots`
  - 新增字段：
    - `enrichedPrompt` TEXT NULL
  - 新增索引：
    - `shots_sceneId_index_idx` ON `shots(sceneId, index)`
  - 数据影响：新增可空字段 + 索引，安全。

- `Task`
  - 新增索引：
    - `Task_status_createdAt_idx` ON `"Task"(status, createdAt)`
  - 数据影响：仅索引，读取性能优化，安全。

- `worker_nodes`
  - 新增索引：
    - `worker_nodes_status_idx` ON `worker_nodes(status)`
  - 数据影响：仅索引，安全。

### 1.2 新增表（全部为 ADD_SAFE）

- 引擎与 RBAC（已在 Stage2/引擎批次实现，但此处为 DB 部分）
  - `engines`
  - `engine_versions`
  - `nonce_store`
  - `roles`
  - `permissions`
  - `role_permissions`
  - `project_members`
  - `audit_log`（已在 schema 中标记为 `AuditLogLegacy` + `@@ignore`，但 DB 仍有物理表）
  - 相关唯一索引/外键：
    - `engines_engineKey_key`
    - `engine_versions_engineId_versionName_key`
    - `nonce_store_nonce_apiKey_key`
    - `roles_name_key`
    - `permissions_key_key`
    - `role_permissions_roleId_permissionId_key`
    - `project_members_userId_projectId_key`
    - `audit_log_*_idx`（userId/resourceId/action/timestamp）
    - 外键：`engine_versions.engineId → engines.id`，`role_permissions(roleId/permissionId)`，`project_members(projectId/roleId)`
  - 数据影响：纯新增表 + FK，以前不存在，执行后需确保应用层兼容空表场景。

- Media & Security
  - `assets`
  - `security_fingerprints`
  - `shot_variants`
  - `video_jobs`

- Character & Novel & Memory
  - `characters`
  - `novel_volumes`
  - `novel_scenes`
  - `memory_short_term`
  - `memory_long_term`
  - 索引：
    - `characters_projectId_name_idx`
    - `novel_scenes_chapterId_index_idx`
  - 数据影响：纯新增表，迁移时不会影响既有数据，但后续可选进行数据回填或增量导入。

---

## 2. 风险点与数据问题分析

### 2.1 episodes.seasonId 非空收紧

- 变更内容：`ALTER TABLE "episodes" ALTER COLUMN "seasonId" SET NOT NULL;`
- 已知问题：
  - 当前 DB 中存在 `episodes.seasonId IS NULL` 的记录（Prisma 报告 472 行，仅供参考，需以实际查询为准）。
- 风险：
  - 若直接执行迁移：
    - PostgreSQL 将因 NOT NULL 约束而拒绝变更，导致迁移失败。
    - 或在手工 DDL 下强制执行可能造成不一致（取决于执行方式）。
- 业务语义：
  - 根据 Spec，Episode 必须归属于某个 Season，`seasonId` 非空是合理约束。
  - 当前 NULL 数据多半是历史数据或“未完备创建”的脏数据，需要清洗或业务决策。

### 2.2 legacy 审计表 `audit_log` 与新表 `audit_logs`

- 变化：
  - migration 中会创建物理表 `audit_log`（legacy 结构）。
  - schema 中：`AuditLogLegacy` 已 `@@ignore`，`AuditLog` 使用新表 `audit_logs`。
- 风险：
  - DB 层同时存在 `audit_log` 与 `audit_logs` 两张表：
    - `audit_log`：旧结构，仅用于保留/迁移历史数据。
    - `audit_logs`：新结构（含 nonce/signature/timestamp 等）。
  - 后续可能需要：
    - 将 `audit_log` 中的历史数据迁移到 `audit_logs`（字段映射、补齐缺失字段）。
    - 或在完成迁移后删除 `audit_log`（DROP_RISKY，需单独批次与备份）。
  - 本 SOP 中仅规划，不执行。

### 2.3 新增表的数据初始化/回填

- 对于新增表（`assets`/`shot_variants`/`video_jobs`/`characters`/`novel_*`/`memory_*` 等）：
  - 短期内可为空表，由后续业务逻辑陆续写入。
  - 若需要从现有表回填（例如根据 shots 生成初始 `shot_variants`、根据 NovelSource 生成初始 `novel_volumes`/`novel_scenes`），应：
    - 在单独“数据导入/回填”批次规划，避免与 schema 迁移强耦合。
    - 避免一次性在 PROD 环境写入大量数据引起锁/性能抖动。

---

## 3. 检查与清洗方案（仅方案，不执行）

### 3.1 episodes.seasonId NULL 检查 SQL 模板

**只读检查示例：**

- 统计 NULL 数量：
```sql
SELECT COUNT(*) AS null_season_episodes
FROM episodes
WHERE "seasonId" IS NULL;
```

- 按 project 维度查看分布：
```sql
SELECT e."projectId", COUNT(*) AS cnt
FROM episodes e
WHERE e."seasonId" IS NULL
GROUP BY e."projectId"
ORDER BY cnt DESC;
```

- 查看部分样本：
```sql
SELECT e.*
FROM episodes e
WHERE e."seasonId" IS NULL
ORDER BY e."createdAt" DESC
LIMIT 50;
```

### 3.2 清洗策略 A：为孤立 episodes 创建/指派“默认 Season”

**思路：**
- 对每个有 `seasonId IS NULL` 的 Episode：
  - 若所在 project 已存在 Season，则：
    - 将 Episode 关联到某个合适的 Season（例如 index 最小的 Season 或专门的 “Unassigned/Default Season”）。
  - 若 project 尚无 Season，则：
    - 先为该 project 创建一个默认 Season（如 `title='Default Season'`，`index=1`），再将所有孤立 Episode 关联到该 Season。

**优点：**
- 保留所有 Episode 数据，不丢失业务历史。
- 满足 Spec 对 Season 归属的约束。

**缺点：**
- 需要与产品/业务确认“默认 Season”语义是否可接受。
- 需要额外写入 Season 记录，有轻微业务语义偏差。

**示例 SQL（需根据实际 schema 字段名调整，仅为模板）：**

1. 为无 Season 的 project 创建默认 Season：
```sql
-- 找出存在孤立 episodes 且没有任何 season 的 project
WITH projects_with_null_episodes AS (
  SELECT DISTINCT e."projectId"
  FROM episodes e
  WHERE e."seasonId" IS NULL
),
projects_without_season AS (
  SELECT p.*
  FROM projects p
  JOIN projects_with_null_episodes pe ON pe."projectId" = p.id
  LEFT JOIN seasons s ON s."projectId" = p.id
  WHERE s.id IS NULL
)
-- 为这些 project 创建默认 season（示例）
-- 实际可改为在应用层批量创建
```

2. 将孤立 episodes 绑定到某个 Season（如 index 最小的 Season）：
```sql
UPDATE episodes e
SET "seasonId" = s.id
FROM seasons s
WHERE e."seasonId" IS NULL
  AND e."projectId" = s."projectId"
  AND s."index" = 1; -- 或者其它规则
```

> 注：实际执行前需先在 DEV/STAGING 环境试跑并验证效果，避免误绑。

### 3.3 清洗策略 B：将孤立 episodes 标记为废弃或删除

**思路：**
- 若业务允许认为这些孤立 Episodes 无价值：
  - 可选择软删除（例如设置 `status='DEPRECATED'` 或 `deletedAt` 字段，如存在）。
  - 或在极端情况下物理删除记录。

**优点：**
- 保持 Season 约束干净，不引入“默认 Season”的语义。

**缺点：**
- 可能丢失历史数据，需要业务方明确同意，并确认与上层 UI/接口的一致性。

**示例 SQL（软删除/硬删除模板）：**

```sql
-- 若有 status 字段，可设为 DEPRECATED
UPDATE episodes
SET status = 'DEPRECATED'
WHERE "seasonId" IS NULL;

-- 或物理删除（高风险，需要强制确认和备份）
DELETE FROM episodes
WHERE "seasonId" IS NULL;
```

> 强烈建议：先软删除/打标，再在后续批次评估是否需要物理删除。

### 3.4 清洗策略 C：保留 seasonId 可空（偏离 Spec 的备选方案）

**思路：**
- 若短期内无法完成数据清洗，也不希望在 Stage1 立即收紧约束：
  - 可考虑暂缓执行 `ALTER COLUMN "seasonId" SET NOT NULL`，保持其为可空。

**优点：**
- 不需要在当前迁移窗口内处理历史数据。

**缺点：**
- 与 DB Spec V1.1 不完全一致，需要在 `STAGE1_OFFICIAL_SPECS_EXTRACT` 上追加“已知偏差”记录。
- 需要在后续 Stage（例如 Stage1.5 / Stage2）中专门开批次收紧约束。

**操作建议：**
- 在 PROD 中执行迁移前，可由 DBA 编辑 `migration.sql`，暂时移除 `ALTER TABLE "episodes" ALTER COLUMN "seasonId" SET NOT NULL;` 行，并在文档中记录该偏差。
- 由后续专门“Constraint Tightening” 批次重新补上。

---

## 4. 迁移执行步骤（逻辑顺序规划）

> 以下所有步骤必须先在 DEV → STAGING 全量验证通过后，才可考虑在 PROD 执行。

### Step 0：备份与准备

- 环境要求：
  - DEV：可随时清库/重建。
  - STAGING：具备与 PROD 近似数据规模与结构。
  - PROD：有数据库备份与回滚机制（快照/物理备份）。
- 必须操作（在 SOP 中强制要求）：
  - 对目标数据库执行全量备份或创建快照。
  - 确认无长期运行的写操作/批处理任务（选择业务低峰期）。
  - 确认应用有可接受的只读窗口（如需）。

### Step 1：只读检查

- 执行所有 episodes.seasonId 相关检查 SQL（见 3.1）。
- 对关键表进行结构/数据量检查：
  - `SELECT COUNT(*) FROM episodes;`
  - `SELECT COUNT(*) FROM scenes;`
  - `SELECT COUNT(*) FROM shots;`
  - 检查是否已存在同名表/索引（避免迁移失败）：
    - `select tablename from pg_tables where tablename in ('engines','engine_versions','nonce_store',...);`
    - 若已存在需评估是否为手工创建，避免迁移重建冲突。

### Step 2：数据清洗（根据选定策略）

- 在 DEV 环境：
  - 按策略 A/B 之一（或自定义组合）执行 episodes.seasonId 的清洗 SQL。
  - 再次检查 `episodes.seasonId IS NULL` 是否为 0。
- 在 STAGING 环境：
  - 重复 DEV 步骤，确认清洗脚本在接近真实数据规模下运行正常（执行时间、锁冲突情况）。
- 在 PROD 环境：
  - 同步采用已经在 STAGING 验证过的脚本版本，执行前再次确认：
    - `SELECT COUNT(*) FROM episodes WHERE "seasonId" IS NULL;` 的数量与预期一致。

### Step 3：执行迁移（应用 20251211091222_stage1_add_safe）

- 推荐命令（示例，最终以项目实际脚本为准）：

```bash
# DEV / STAGING / PROD 中执行（按顺序）：
cd packages/database
pnpm prisma:migrate:deploy    # 若使用 migrate deploy 流程

# 或（仅在 DEV）：
pnpm prisma:migrate           # 已创建的迁移会被应用
```

- 注意事项：
  - 在 PROD 环境优先使用 `migrate deploy` 而非 `migrate dev`。
  - 如果选择策略 C（暂不收紧 seasonId 非空），需在执行前根据业务决定是否手动编辑 migration.sql，移除对应 ALTER 语句，并在文档/变更记录中注明。

### Step 4：迁移后验证

- 结构验证（schema level）：
  - 在目标 DB 上检查：
    - 新增字段是否存在：`audit_logs.nonce/signature/timestamp`、`scenes.characters/enrichedText/projectId/visualDensityScore`、`shots.enrichedPrompt`。
    - 新表是否存在：`engines`、`engine_versions`、`nonce_store`、`roles`、`permissions`、`role_permissions`、`project_members`、`assets`、`security_fingerprints`、`shot_variants`、`video_jobs`、`characters`、`novel_volumes`、`novel_scenes`、`memory_short_term`、`memory_long_term`。
    - 新索引是否存在：`Task_status_createdAt_idx`、`worker_nodes_status_idx`、`audit_logs_nonce_timestamp_idx`、`scenes_projectId_index_idx`、`shots_sceneId_index_idx` 等。

- 数据一致性检查：
  - 再次确认 `episodes.seasonId IS NULL` 数量为 0（若采纳非空策略）。
  - 抽查若干 Episode/Scene/Shot，确认关联关系仍然完整。
  - 若已有业务逻辑写入 `assets`/`characters` 等新表，抽样检查数据是否符合预期。

- 应用侧验证：
  - 在 DEV/STAGING 上运行完整回归（API / Worker / Web 构建和关键功能路径）。
  - 在 PROD 逐步恢复写流量，观察错误日志、慢查询、锁等待等指标。

---

## 5. 回滚建议

- DEV / STAGING：
  - 优先通过清空数据库并重新运行迁移的方式回滚。
  - 或通过删除最新迁移 + 重置 DB 实现。

- PROD：
  - 强烈建议依赖数据库级别的备份/快照：
    - 在执行 Step 3 前必须创建可恢复的快照。
    - 若迁移后发现严重问题，优先**整体回滚到快照**，而不是手工逐步回滚 DDL/DML。
  - 若仅是数据层问题（例如 episodes 清洗逻辑错误）：
    - 优先通过对照备份/审计表（如 `audit_log`）进行定向修复，而非简单删除数据。

---

## 6. 小结

- 本 SOP 主要覆盖：
  - `20251211091222_stage1_add_safe` 中所有 ADD_SAFE 变更项的结构描述；
  - episodes.seasonId 非空收紧的风险分析与多方案清洗策略；
  - DEV → STAGING → PROD 的执行顺序、检查点与回滚建议。
- 实际执行迁移前，必须：
  - 明确选择一种 episodes.seasonId 清洗策略（A/B/C 或组合）；
  - 在 DEV/STAGING 完成至少一次全流程演练；
  - 在 PROD 做好备份与回滚准备，并在业务低峰期执行。

---

## 7. DEV 执行记录（2025-12-11）
- 目标库：DEV（`postgresql://localhost:5432/super_caterpillar_dev`，本地实验库，非 PROD）
- Step1 检查（迁移前）：episodes 总 483；seasonId IS NULL 472；涉及 4 个 project（06fa9a92…, 50dda522…, 849f47d5…, da8c5a9e…）。
- Step2 清洗（策略 A）：为每个 project 绑定 index 最小的 Season（本次均已有 Season，未新建）；更新结果 118/236/59/59；清洗后 NULL=0。
- Step3 迁移：`pnpm --filter database prisma:migrate:deploy`（DEV 数据库），迁移 `20251211091222_stage1_add_safe` 成功应用。
- Step4 验证：新增表 assets/security_fingerprints/shot_variants/video_jobs/characters/novel_volumes/novel_scenes/memory_short_term/memory_long_term 存在；audit_logs 含 nonce/signature/timestamp；索引 scenes(projectId,index)、shots(sceneId,index)、tasks(status,createdAt)、worker_nodes(status)、audit_logs(nonce,timestamp) 均存在。
- Step5 应用侧（DEV）简要：`pnpm build` 通过；HMAC/权限/审计链路已按 Stage1 完成（如出现 500，请复查清洗与迁移）。


