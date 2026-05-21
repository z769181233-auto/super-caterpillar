# STATUS

## 当前任务
等待下一个小说分析质量 milestone。

## 已完成
- `stash@{0}` 已完成只读 inventory：`98a59074a chore: document quarantined stash inventory`。
- auth/security 小切片已单独提交：`d17451558 fix(auth): align budget guard organization context`。
- display-only project-detail / structure UI 小切片已单独提交：`d019fa400 feat(web): restore display-only structure results tab`。
- review evidence 只读切片已单独提交：`7c063116a feat(review): surface read-only review evidence queue`。
- overview proxy / API base 只读切片已单独提交：`56ef0fbf9 fix(web): add read-only project overview proxy`。
- project structure 只读代理切片已单独提交：`b661d4121 fix(web): add read-only project structure proxy`。
- smoke studio receipt dry-run 脚本切片已单独提交：`a0aa5ab85 chore(smoke): add studio receipt dry run`。
- Common 导航文案 i18n display-only 切片已单独提交：`f7df4808c fix(web): add common nav translations`。
- Director Layer acceptance registry spec 切片已单独提交：`629083308 chore(spec): lock director layer acceptance target`。
- stash remaining low-risk candidate evaluation 文档切片已单独提交：`76c5152f4 docs(hygiene): evaluate remaining stash candidates`。
- ProjectDetail i18n display-only 切片已完成：三语言项目详情页文案已收敛为视频剧本 / 小说分析状态 / 下一步说明语义。
- 小说分析质量 M6/M7 阻断原因透传已完成：Studio v2 的 EpisodePlan / DirectorScript / ShotScript 生成接口现在可以读取 Nest 顶层 `message`，保留 `coverageReport.sceneCandidates` 质量门禁阻断详情，不再退化为 generic error。

## 进行中
- 无。

## 未完成
- Storyboard image / video generation 继续隔离。
- Film IR、content gates、continuity、workers、shot planner 等高风险代码块继续隔离。
- Prisma migration 继续隔离。
- stash 中其他业务线改动仍需后续单独 milestone 消化。

## 当前风险
- 本轮只能改前端错误透传，不能扩展到后端生成算法或 worker。
- 仍不能进入 storyboard image / video generation。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- 本轮只解决阻断原因可见性；不提升章节拆分、人物抽取、场景抽取本身的召回率。
- 当前仍不生成 Storyboard 图片或视频资产。

## 验证状态
- `pnpm exec tsx apps/web/src/features/studio-v2/studio-api-errors.test.ts` 通过。
- `pnpm exec tsx apps/web/src/features/studio-v2/studio-generation-blockers.test.ts` 通过。
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit` 通过。
- `pnpm --filter web exec eslint src/features/studio-v2/api.ts src/features/studio-v2/studio-api-errors.ts` 通过。
- `pnpm --filter web build` 通过。
- `git diff --check` 通过。

## 当前是否允许恢复新功能开发
no

## 原因
当前只完成小说分析质量阻断原因可见性；下一步仍应继续小说分析质量主线或继续 hygiene，不进入图片、视频或大范围 Studio 新功能。
