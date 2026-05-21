# STATUS

## 当前任务
等待下一个 hygiene milestone。

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

## 进行中
- 无。

## 未完成
- Storyboard image / video generation 继续隔离。
- Film IR、content gates、continuity、workers、shot planner 等高风险代码块继续隔离。
- Prisma migration 继续隔离。
- stash 中其他业务线改动仍需后续单独 milestone 消化。

## 当前风险
- 当前剩余 stash 多数是运行时代码、CI、Prisma、worker、Film IR、shot planner 或 storyboard image / video generation，不能按文件名盲目恢复。
- 剩余纯测试文件多数依赖未恢复运行时代码，不能单独恢复。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- 当前切片只更新 hygiene 文档；不修复小说分析质量，不生成 StoryBible、CharacterBible、StoryboardAsset 或视频资产。

## 验证状态
- `git diff --check`：通过。
- `git status --short --untracked-files=all`：通过，仅计划内文档文件修改。
- `git stash list --date=local | head -3`：通过，`stash@{0}` 仍保留。
- `git diff --name-status HEAD 'stash@{0}' -- docs apps/web/src/features apps/web/src/app apps/api/src apps/workers/src packages/shared-types .github packages/database/prisma | sed -n '1,220p'`：通过，用于复核剩余 stash 风险分类。

## 当前是否允许恢复新功能开发
no

## 原因
当前仍处于 hygiene 小切片恢复阶段，只允许 spec/display 文档复核，不进入图片、视频或大范围 Studio 新功能。
