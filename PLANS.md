# 当前计划：asset receipt / review evidence 只读切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆出 asset receipt / review evidence 相关的只读展示与规格能力：后端提供审核队列 evidence 聚合接口，前端 Review Queue 页面展示策略、语义、审批证据。继续排除 Storyboard image / video generation。

## 请求流
用户进入旧 Review Queue 页面 -> `ReviewQueuePageContent` 调用现有 `projectApi.getQualityReviewQueue` -> API `GET /api/projects/:projectId/quality/review-queue` -> `ProjectService.listQualityReviewQueue` 从现有 `PublishedVideo` / `Asset` / `PublishingReview` / metadata 聚合只读 evidence -> 前端展示，不触发重跑。

## 数据流
现有 `PublishedVideo.metadata.directorLayer|timelineLayer` 和 `PublishingReview.result/status/note` -> `normalizeReviewPolicy` 归一化审核策略证据 -> Review Queue DTO 字段：policy stage、review policy result/source、publish eligibility、semantic location/time/characters/conflict、approval evidence。

## 状态流
无 published video 时返回空队列；有待处理证据时 `PENDING` 过滤展示；已处理证据在 `DONE` 过滤展示。任何缺失字段只显示空值或 `UNKNOWN`，不得伪造成完成资产。

## 修改边界
- 允许：`ProjectService` 新增只读 list 方法、`ProjectController` 新增 GET 路由、Review Queue 页面只读 evidence 列、对应单测、`PLANS.md` / `STATUS.md`。
- 禁止：恢复 rerun POST 操作、恢复 storyboard-assets/storyboard-images、调用图片/视频生成、修改 worker、修改 Prisma、修改旧 novel import、修改旧结构/项目详情链路。

## Milestone Review Evidence Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project.controller.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project.service.review-queue.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/projects/pages/ReviewQueuePageContent.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 旧小说导入、旧项目详情、旧结构页不被修改。
- `GET /api/projects/:projectId/quality/review-queue` 返回稳定 JSON。
- `PENDING` 不把已处理审核误判为待处理。
- `DONE` 能展示已有 final review/approval evidence。
- 前端只展示 evidence，不提供重跑按钮。
- 不出现图片/视频生成入口或调用。
- 不做 Prisma migration。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter api test -- project.service.review-queue.spec.ts`
- `pnpm --filter api exec eslint src/project/project.service.ts src/project/project.controller.ts src/project/project.service.review-queue.spec.ts`
- `pnpm --filter api typecheck`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/features/projects/pages/ReviewQueuePageContent.tsx`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
