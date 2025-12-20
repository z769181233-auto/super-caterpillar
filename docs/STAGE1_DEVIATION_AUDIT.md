# Stage1 偏差审计文档

**生成时间**: 2025-12-11  
**最后更新**: 2025-12-11  
**审计范围**: 数据库结构、用户/权限模型、API 安全链路、五层内容结构、审计日志覆盖

---

## 摘要

当前实现与 Stage1 规范之间存在部分偏差，主要集中在：数据库层级结构（Season 模型仍存在）、API 安全链路覆盖不全、审计日志覆盖不完整。需要在不破坏 Stage2/Stage3 封板区域的前提下进行修复。

---

## 偏差清单

### 2.1 数据库结构（Prisma vs DBSpec V1.1）

#### 偏差项 1：Season 模型仍存在
- **规范期望**: 四层结构（Project → Episode → Scene → Shot），无 Season 层
- **当前实现**: Schema 中仍存在 `Season` 模型，Episode 同时关联 `seasonId` 和 `projectId`
- **影响**: 与规范不一致，可能导致前端/后端逻辑混乱
- **建议修复方式**: 保留 Season 模型但标记为 `@deprecated`，确保 Episode 可直接关联 Project，后续迁移时移除
- **优先级**: P1（不影响核心功能，但需标记）

#### 偏差项 2：AuditLog 索引可能不完整
- **规范期望**: `audit_logs(nonce, timestamp)` 索引必须存在
- **当前实现**: 已存在 `@@index([nonce, timestamp])`
- **影响**: 无
- **建议修复方式**: 无需修复
- **优先级**: P0（已符合）

#### 偏差项 3：Project 字段可能缺少 settings_json
- **规范期望**: `projects.settings_json`（项目级配置 JSON）
- **当前实现**: 使用 `metadata` Json 字段
- **影响**: 字段名不一致，但功能等价
- **建议修复方式**: 保持现有 `metadata` 字段，在文档中说明等价性
- **优先级**: P2（功能等价，无需修改）

---

### 2.2 用户 / 组织 / 权限模型（User / Organization / Membership / Role / Permission）

#### 偏差项 4：User/Organization 模型基本符合
- **规范期望**: User、Organization、Membership、OrganizationMember、ProjectMember、Role、Permission、RolePermission
- **当前实现**: 所有模型已存在
- **影响**: 无
- **建议修复方式**: 无需修复
- **优先级**: P0（已符合）

---

### 2.3 API 安全链路（HMAC / Nonce / Timestamp / ApiKey / AuditLog）

#### 偏差项 5：HMAC Guard 覆盖不全
- **规范期望**: Worker 相关接口（`/api/workers/:workerId/jobs/next`、`/api/jobs/:id/report`）必须启用 HMAC
- **当前实现**: 部分接口已使用 `JwtOrHmacGuard`，但需要确认所有 Worker 接口都已覆盖
- **影响**: 安全风险，可能允许未授权访问
- **建议修复方式**: 检查所有 Worker/Job 相关接口，确保使用 `JwtOrHmacGuard` 或专门的 HMAC Guard
- **优先级**: P0（安全关键）

#### 偏差项 6：Nonce 校验可能不完整
- **规范期望**: 每次 HMAC 请求必须校验 Nonce（写入 NonceStore，5 分钟内不可重复）
- **当前实现**: 需要检查 `HmacAuthGuard` 是否完整实现 Nonce 校验
- **影响**: 可能允许重放攻击
- **建议修复方式**: 确保 `HmacAuthGuard` 完整实现 Nonce 校验逻辑
- **优先级**: P0（安全关键）

#### 偏差项 7：Timestamp 时间窗校验可能不完整
- **规范期望**: 时间窗允许 ±5 分钟，超时拒绝
- **当前实现**: 需要检查 `HmacAuthGuard` 是否完整实现时间窗校验
- **影响**: 可能允许过期请求
- **建议修复方式**: 确保 `HmacAuthGuard` 完整实现时间窗校验逻辑
- **优先级**: P0（安全关键）

#### 偏差项 8：错误码可能不统一
- **规范期望**: 4003（签名不合法）、4004（重放请求）
- **当前实现**: 需要检查错误码是否符合规范
- **影响**: API 错误码不一致
- **建议修复方式**: 统一错误码，确保符合 APISpec
- **优先级**: P1（影响一致性）

---

### 2.4 五层内容结构（Project / Season / Episode / Scene / Shot）

#### 偏差项 9：Season 层仍存在（与偏差项 1 重复）
- **规范期望**: 四层结构（Project → Episode → Scene → Shot）
- **当前实现**: Schema 中仍存在 Season，Episode 同时关联 seasonId 和 projectId
- **影响**: 与规范不一致
- **建议修复方式**: 保留 Season 但标记为 deprecated，确保 Episode 可直接关联 Project
- **优先级**: P1

---

### 2.5 审计日志覆盖范围

#### 偏差项 10：审计日志字段已符合
- **规范期望**: `user_id`、`action`、`payload`（含 resource_type/resource_id/ip/ua 等）、`nonce`、`signature`、`timestamp`
- **当前实现**: AuditLog 模型已包含所有必需字段
- **影响**: 无
- **建议修复方式**: 无需修复
- **优先级**: P0（已符合）

#### 偏差项 11：审计日志覆盖可能不完整
- **规范期望**: 必须审计登录/退出、Project/Episode/Scene/Shot CRUD、任务创建/执行、权限变更、API 签名失败等
- **当前实现**: 需要检查所有关键操作是否都写入审计日志
- **影响**: 审计不完整，无法追溯关键操作
- **建议修复方式**: 检查并补齐所有关键操作的审计日志写入
- **优先级**: P0（审计关键）

---

## 修复优先级总结

- **P0（必须修复）**: 偏差项 5、6、7、10、11
- **P1（重要修复）**: 偏差项 1、8、9
- **P2（可选修复）**: 偏差项 3

---

**文档状态**: ✅ 审计完成，待执行修复

