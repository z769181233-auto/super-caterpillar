# DEV 迁移验证报告（Stage1）

## 1. 概览

- DEV 环境已按《STAGE1_DB_MIGRATION_SOP》执行策略 A 清洗 episodes.seasonId 并应用迁移 `20251211091222_stage1_add_safe`，基础验证通过。
- 未对 schema/migrations 作任何额外改动；未触及 PROD，仅限 DEV 试验库。

## 2. DEV 数据库信息

- 连接标识（脱敏）：`postgresql://localhost:5432/super_caterpillar_dev`
- 本库为可丢弃试验库，仅用于 Stage1 DEV 迁移演练。

## 3. episodes.seasonId 清洗验证

- 清洗前：episodes 总 483，seasonId NULL=472，涉及 4 个 project。
- 策略：SOP 策略 A（为每个 project 绑定 index 最小的 Season；如无则创建默认 Season）。
- 绑定数量：按 project 更新 118 / 236 / 59 / 59；本次未新增 Season（0 条新建）。
- 清洗后：seasonId NULL=0。

## 4. 迁移执行验证

- 命令：`pnpm --filter database prisma:migrate:deploy`
- 结果：成功应用迁移 `20251211091222_stage1_add_safe`（DEV）。
- 日志摘要：Prisma migrate deploy 成功，无错误。

## 5. 表结构验证

- 新增表存在：assets / security_fingerprints / shot_variants / video_jobs / characters / novel_volumes / novel_scenes / memory_short_term / memory_long_term。
- audit_logs 字段：nonce / signature / timestamp 已存在。
- 关键索引存在：scenes(projectId,index)、shots(sceneId,index)、tasks(status,createdAt)、worker_nodes(status)、audit_logs(nonce,timestamp) 等。
- 失败项：0。

## 6. 基础回归验证

- 构建：`pnpm build` 成功。
- HMAC 链路：Worker 拉取/上报含 signature/nonce/timestamp 正常，错误签名/重放/时间窗返回 4003/4004 并审计。
- 权限：无配置时保守 403；Project/五层级/Job 管理接口按权限守卫正常。
- 审计：登录/CRUD/任务/Job/HMAC 安全事件写入正常，未见缺字段报错（如目标库缺字段，写库失败会被捕获为 warning）。

## 7. 结论

- Stage1（DEV）：完成。
- 状态：可推进下一阶段（Stage2 可正式开始）。
- 提醒：STAGING/PROD 需独立按 SOP 清洗并执行迁移后再回归。

## 8. 附录

- 参考：`docs/STAGE1_DB_MIGRATION_SOP.md`
- 参考：`docs/STAGE1_EXECUTION_REPORT.md`（已更新 DEV 状态）
