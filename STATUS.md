# STATUS

## 当前任务
project structure 只读代理切片。

## 已完成
- `stash@{0}` 已完成只读 inventory：`98a59074a chore: document quarantined stash inventory`。
- auth/security 小切片已单独提交：`d17451558 fix(auth): align budget guard organization context`。
- display-only project-detail / structure UI 小切片已单独提交：`d019fa400 feat(web): restore display-only structure results tab`。
- review evidence 只读切片已单独提交：`7c063116a feat(review): surface read-only review evidence queue`。
- overview proxy / API base 只读切片已单独提交：`56ef0fbf9 fix(web): add read-only project overview proxy`。
- 当前工作区在本轮开始前为 clean，`stash@{0}` 继续保留。
- 已完成 project structure 只读代理切片：新增 `/api/projects/:projectId/structure` Web 代理与测试。

## 进行中
- 等待下一个 hygiene milestone。

## 未完成
- Storyboard image / video generation 继续隔离。
- Prisma migration 继续隔离。
- 图片生成、视频生成、worker 生产链路不在本轮范围内。
- stash 中其他业务线改动仍需后续单独 milestone 消化。

## 当前风险
- 不能把 structure 代理扩展成结构生成或 storyboard image 代理。
- 不能恢复任何 storyboard image / video generation route。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- 当前切片只修复旧结构结果读取代理；不生成 StoryBible、CharacterBible、StoryboardAsset 或视频资产。

## 验证状态
- `pnpm --filter web exec tsx src/app/api/projects/[projectId]/structure/route.test.ts`: pass
- `pnpm --filter web exec tsx src/features/project-detail/api.test.ts`: pass
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`: pass
- `pnpm --filter web exec eslint src/app/api/projects/[projectId]/structure/route.ts src/app/api/projects/[projectId]/structure/route.test.ts`: pass
- `pnpm --filter web build`: pass
- diff scope check for storyboard/image/video/generate: pass, no matches outside status/plan

## 当前是否允许恢复新功能开发
no

## 原因
当前仍处于 hygiene 小切片恢复阶段，只恢复只读结构代理，不进入图片、视频或大范围 Studio 新功能。
