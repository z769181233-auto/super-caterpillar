# 当前计划：stash@{0} auth/security 小切片

## 目标
从 `stash@{0}` 中只恢复 auth/security 相关的最小安全切片，避免再次形成大 dirty 工作区。本轮只处理 `BudgetGuard` / `HmacAuthGuard`，继续排除 display UI、Storyboard image、video generation、Prisma migration 和 worker 改动。

## 请求流
Job API 请求先经过 `JwtOrHmacGuard`，再经过 `QuotaGuard` / `BudgetGuard`。`BudgetGuard` 必须用与当前组织上下文一致的 organizationId 做预算检查，否则会出现“Controller 使用 header org 创建任务，但预算检查使用 user org”的不一致。

## 数据流
认证上下文 `request.apiKeyOwnerOrgId` / `request.user.organizationId` / 组织 header -> `BudgetService.getBudgetStatus(organizationId)` -> request 注入 `budgetLevel` / `budgetRatio` -> 审计记录。HMAC slice 只清理无意义注释，不改变签名校验逻辑。

## 状态流
无组织上下文时继续 `ForbiddenException`；预算阻断状态保持现有行为；有组织上下文时允许进入预算判断。

## 修改边界
- 允许：`BudgetGuard` 组织上下文解析、无用 timestamp/comment 清理、相关单测。
- 禁止：恢复 `stash@{0}` 其他文件、修改 `JwtOrHmacGuard`、修改 worker、修改 Storyboard/video、修改 Prisma migration。

## Milestone Auth Security Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/auth/guards/budget.guard.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/auth/guards/budget.guard.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/auth/hmac/hmac-auth.guard.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- `BudgetGuard` 支持 `x-organization-id`、`x-scu-org-id`、`x-org-id` 作为组织上下文 fallback。
- `apiKeyOwnerOrgId` 和 `user.organizationId` 优先级不被 header 覆盖。
- 无组织上下文仍然拒绝。
- HMAC 签名逻辑不改变。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter api test -- budget.guard.spec.ts`
- `pnpm --filter api exec eslint src/auth/guards/budget.guard.ts src/auth/guards/budget.guard.spec.ts src/auth/hmac/hmac-auth.guard.ts`
- `pnpm --filter api typecheck`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
