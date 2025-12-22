# Stage 35: Schema/Enum 不一致性研究报告

## 执行时间

2025-12-22T13:54:00+07:00

## RESEARCH 目标

查明 Prisma schema 与数据库中 enum 值的差异，定位导致 Day 2 出现 `Value 'admin' not found in enum 'UserRole'` 错误的根本原因。

---

## 发现摘要

### Prisma Schema Enum 定义（33个）

从 `packages/database/prisma/schema.prisma` 提取：

1. UserType
2. UserRole
3. UserTier
4. MembershipRole
5. TextSafetyDecision
6. ProjectStatus
7. ShotStatus
8. ShotReviewStatus
9. SubscriptionStatus
10. JobStatus
11. JobType
12. JobEngineBindingStatus
13. EngineTaskType
14. EngineTaskStatus
15. TaskType
16. TaskStatus
17. WorkerJobType
18. WorkerJobStatus
19. WorkerStatus
20. ModelType
21. TemplateType
22. RiskLevel
23. ReviewStatus
24. BillingEventType
25. BillingStatus
26. ReviewType
27. ReviewResult
28. OrganizationRole
29. SceneDraftStatus
30. NovelAnalysisJobType
31. NovelAnalysisStatus
32. ApiKeyStatus
33. AssetOwnerType, AssetType, AssetStatus

### 数据库实际 Enum 类型（40个）

从 `pg_type/pg_enum` 查询结果：

**数据库专用（全小写/蛇形命名）**：

- `api_key_status`
- `billing_event_type`
- `billing_status`
- `engine_task_status`
- `engine_task_type`
- `job_engine_binding_status`
- `membership_role`
- `model_type`
- `novel_analysis_job_type`
- `novel_analysis_status`
- `organization_role`
- `project_status`
- `review_result`
- `review_status`
- `review_type`
- `risk_level`
- `scene_draft_status`
- `shot_review_status`
- `shot_status`
- `subscription_status`
- `template_type`
- `user_role` ⚠️
- `user_tier`
- `user_type` ⚠️
- `worker_job_status`
- `worker_job_type`
- `worker_status`
- `AssetOwnerType`
- `AssetStatus`
- `AssetType`
- `JobStatus`
- `JobType`
- `TaskStatus`
- `TaskType`

---

## 关键差异分析

### 🔴 P0 差异：UserRole

**Prisma Schema (schema.prisma:774)**:

```prisma
enum UserRole {
  viewer
  editor
  creator
}
```

**数据库实际值 (`user_role` enum)**:

```
- viewer
- editor
- creator
- admin  ⚠️ EXTRA
```

**影响**:

- **Day 2 错误根源**: 数据库中存在 `role='admin'` 的用户记录
- Prisma 查询时尝试解码 `admin` 值，但 schema 中未定义，触发：
  ```
  Value 'admin' not found in enum 'UserRole'
  ```
- **所有依赖 User 模型的 ORM 查询**（包含 include/select role 字段）都可能失败

### ⚠️ P1 差异：UserType

**Prisma Schema (schema.prisma:766)**:

```prisma
enum UserType {
  individual
  organization_member
}
```

**数据库实际值 (`user_type` enum)**:

```
- individual
- organization_member
- admin  ⚠️ EXTRA
```

**影响**: 同上，若数据中存在 `type='admin'` 的用户会触发类似错误

---

## 命名约定不一致

### Prisma 使用 PascalCase

- `UserRole`, `UserType`, `JobStatus` 等

### 数据库使用两种风格

1. **蛇形小写**（大部分）: `user_role`, `user_type`, `api_key_status`
2. **PascalCase**（少数）: `AssetOwnerType`, `JobStatus`, `TaskType`

**说明**: Prisma `@@map("user_role")` 可以处理命名差异，但 enum 值必须精确匹配。

---

## 根因总结

1. **数据库 enum 包含 Prisma schema 未定义的值**:
   - `user_role` 多了 `'admin'`
   - `user_type` 多了 `'admin'`

2. **可能的历史原因**:
   - 早期seed/migration直接在DB创建了 `'admin'` 值
   - Prisma schema 后续未同步更新

3. **当前影响**:
   - 所有包含 User 模型的 Prisma 查询（带 role/type 字段）都可能因解码失败而报错
   - Day 1/2 验证中的 `memberships: 0` / `采样为空` 直接由此引起

---

## 产物

**证据文件**: `docs/_evidence/stage35/assets/enum_research.log`

**下一步**: 进入 PLAN 阶段，制定最小修复方案
