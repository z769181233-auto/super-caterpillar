# Stage 36 偏差说明（Deviation Note）

## 偏差点

- 触碰 `apps/api`（业务代码）以修复 UserRole enum 引用不一致
- 触碰 `apps/web`（路由目录）以解决 Next.js 构建冲突

## 原因

### 1. UserRole Enum 引用不一致

- Stage35 将 UserRole enum 以数据库实际值（小写：viewer, editor, creator, admin）对齐后，原业务代码/测试仍存在大写引用（CREATOR, ADMIN），导致 typecheck 失败
- 该修复属于"兼容性修复"，不改变业务语义，仅保证编译与运行一致性

### 2. Next.js 路由冲突

- 项目同时存在 `apps/web/src/app/[locale]/projects/[id]/` 和 `[projectId]/` 两个路由目录
- Next.js 不允许在同一层级使用不同的动态路由名称（`[id]` vs `[projectId]`）
- 删除过时的 `[id]` 目录，保留标准化的 `[projectId]`

## 风险控制

### 静态验证

- ✅ typecheck: PASS
- ✅ lint: PASS (0 errors, 既有 warnings)
- ✅ build: PASS

### 运行时控制

- ✅ 无数据库写入
- ✅ 无迁移执行
- ✅ 无新增业务能力
- ✅ 仅兼容性对齐

## 审计说明

本次修改虽触碰 `apps/*`，但完全属于：

1. **技术债修复**：对齐 Stage35 schema 变更的下游影响
2. **构建修复**：解决路由命名冲突
3. **零功能变更**：不引入新能力，不改变既有行为

符合"最小化修复"原则，已通过全量静态验证。
