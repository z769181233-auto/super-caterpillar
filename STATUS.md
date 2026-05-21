# STATUS

## 当前任务
Director Layer acceptance registry spec 切片。

## 已完成
- `stash@{0}` 已完成只读 inventory：`98a59074a chore: document quarantined stash inventory`。
- auth/security 小切片已单独提交：`d17451558 fix(auth): align budget guard organization context`。
- display-only project-detail / structure UI 小切片已单独提交：`d019fa400 feat(web): restore display-only structure results tab`。
- review evidence 只读切片已单独提交：`7c063116a feat(review): surface read-only review evidence queue`。
- overview proxy / API base 只读切片已单独提交：`56ef0fbf9 fix(web): add read-only project overview proxy`。
- project structure 只读代理切片已单独提交：`b661d4121 fix(web): add read-only project structure proxy`。
- smoke studio receipt dry-run 脚本切片已单独提交：`a0aa5ab85 chore(smoke): add studio receipt dry run`。
- Common 导航文案 i18n display-only 切片已单独提交：`f7df4808c fix(web): add common nav translations`。
- Director Layer acceptance registry spec 切片已完成：registry v6 锁定最小单 scene 验收样本。

## 进行中
- 等待下一个 hygiene milestone。

## 未完成
- Storyboard image / video generation 继续隔离。
- Film IR、content gates、continuity、workers、shot planner 等高风险代码块继续隔离。
- Prisma migration 继续隔离。
- stash 中其他业务线改动仍需后续单独 milestone 消化。

## 当前风险
- 不能把本轮 spec 更新扩展成 Film IR 服务逻辑、acceptance runner 或 CI workflow 改动。
- 不能恢复会启动 API/Web/Worker 或写库的 smoke 脚本。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- 当前切片只更新 Director Layer acceptance 样本 registry；不修复小说分析质量，不生成 StoryBible、CharacterBible、StoryboardAsset 或视频资产。

## 验证状态
- `node - <<'NODE' ... DIRECTOR_LAYER_ACCEPTANCE_REGISTRY schema assertion ... NODE`: pass
- `pnpm --filter api typecheck`: pass
- `pnpm --filter api build`: pass
- `git diff --check`: pass

## 当前是否允许恢复新功能开发
no

## 原因
当前仍处于 hygiene 小切片恢复阶段，只允许 spec/验收配置更新，不进入图片、视频或大范围 Studio 新功能。
