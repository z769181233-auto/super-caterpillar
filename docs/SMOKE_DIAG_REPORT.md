# Smoke/Diag 快照（自动执行结果）

- 运行时间：2025-12-15
- 命令：`bash tools/smoke/run_all.sh`
- API_BASE_URL：`http://localhost:3000`
- DATABASE_URL（脱敏）：`postgresql://postgres:***@localhost:5433/scu_smoke?schema=public`

## DB 诊断（tools/smoke/diag_db.ts）
- 连接：✅ 成功
- current_database/current_schema：`scu_smoke / public`
- prisma_migrations：⚠️ 表不存在（`relation "prisma_migrations" does not exist`）
- 关键表计数：
  - User: 1
  - Organization: 1
  - Project: 0
  - Job: ⚠️ 表不存在
  - ApiKey: 1
- 示例 ApiKey：`scu_smoke_key` (ACTIVE)

## run_all 子测试结果
- Health：✅ `/health/ready` `/health/live` `/health/gpu` 200
- HMAC 正常请求：❌ 401 Invalid API Key
- Nonce 重放：✅ 401（被拒绝，但同样因 Invalid API Key）
- CRUD 最小路径：❌ 401 Invalid API Key（创建 Project 失败）
- Worker 最小流程：❌ 401 Invalid API Key（注册/心跳/领取均失败）
- Stage3-A Engine Binding：❌ 未跑（依赖 CRUD 成功）
- SQL 校验：✅ 全部通过

## 结论与后续
- 列缺失/500 已解除，当前阻塞在 **API Key 校验失败（401）**。
- 建议排查：
  1) API 端加载的 DATABASE_URL 与 `init_api_key.ts` 写入的 DB 是否一致（目前看是 scu_smoke）。
  2) HMAC 校验逻辑是否允许 dev/test 使用 `secretHash`（若需要 `secretEnc`，需在 init_api_key 写入或放宽校验）。
  3) prisma_migrations 表缺失：在 smoke DB 创建迁移表或改用 migrate deploy 生成该表，以便 diag 不再警告。
- 退出码：非 0（因 smoke 失败）。

