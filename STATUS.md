# STATUS

## 当前任务
asset receipt / review evidence 只读切片。

## 已完成
- `stash@{0}` 已完成只读 inventory：`98a59074a chore: document quarantined stash inventory`。
- auth/security 小切片已单独提交：`d17451558 fix(auth): align budget guard organization context`。
- display-only project-detail / structure UI 小切片已单独提交：`d019fa400 feat(web): restore display-only structure results tab`。
- 当前工作区在本轮开始前为 clean，`stash@{0}` 继续保留。
- 已完成 review evidence 只读切片：新增后端审核队列 evidence 聚合、前端只读 evidence 展示、覆盖 ProjectService 单测。

## 进行中
- 等待下一个 hygiene milestone。

## 未完成
- Storyboard image / video generation 继续隔离。
- Prisma migration 继续隔离。
- 图片生成、视频生成、worker 生产链路不在本轮范围内。
- stash 中其他业务线改动仍需后续单独 milestone 消化。

## 当前风险
- 不能把 review evidence 展示误做成审核重跑或自动修复入口。
- 不能恢复任何可触发图片/视频生成的按钮、API route 或 worker 逻辑。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- 当前切片只展示现有 PublishedVideo / PublishingReview evidence；不生成 StoryBible、CharacterBible、StoryboardAsset 或视频资产。

## 验证状态
- `pnpm --filter api test -- project.service.review-queue.spec.ts`: pass
- `pnpm --filter api exec eslint src/project/project.service.ts src/project/project.controller.ts src/project/project.service.review-queue.spec.ts`: pass with existing warnings
- `pnpm --filter api typecheck`: pass
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`: pass
- `pnpm --filter web exec eslint src/features/projects/pages/ReviewQueuePageContent.tsx`: pass
- `pnpm --filter web build`: pass
- `git diff --check`: pass
- `git status --short --untracked-files=all`: expected modified/new files only
- `git stash list --date=local | head -3`: pass, `stash@{0}` preserved

## 当前是否允许恢复新功能开发
no

## 原因
当前仍处于 hygiene 小切片恢复阶段，只恢复只读 evidence，不进入图片、视频或大范围 Studio 新功能。
