# STATUS

## 当前任务
Phase 1A + M12/M13 收口提交准备：不继续开发功能，只完成 storyboard legacy interface 风险降级记录、提交拆分建议和最终 smoke。

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
- 小说分析质量 M7 已完成：ProductionState 只读聚合 `SceneDraft.analysisResult.coverageReport.sceneCandidates` 覆盖率，并在 Studio v2 总览 / 右侧风险面板显示质量不足原因。
- 小说分析质量 M8 已完成：单换行 / 混合标题空行正文现在会拆成更细语义块；连续无换行正文有句子级 fallback；无引号对白、短动作块和人物动作召回已补强，并覆盖《表姑娘又又又又跑了》固定回归样本。
- 小说分析质量 M9 已完成：EpisodePlan 现在只接受可追踪的 medium/high sceneCandidates；DirectorScript / ShotScript 会校验稳定 sourceEvidence，旧摘要或残缺 scene-candidate 字符串会明确阻断，不再伪装成可生产输入。
- 小说分析质量 M10 已完成：新增固定《表姑娘又又又又跑了》文本链路验收，串联 `sceneCandidates -> EpisodePlan -> DirectorScript -> ShotScript`；ShotScript 现在优先消费 parsed scene candidate 的人物、场景、对白/动作证据，不再输出“待编剧精修”占位台词。
- 小说分析质量 M11 已完成：ShotScript 写入前新增文本质量门槛，镜头数、对白抽取率、角色/场景绑定率、source evidence 绑定率和占位文本检查不过关时会明确阻断，不写入低质量镜头台本。
- 小说分析质量 M12 已完成：ShotScript 文本质量门槛已接入 ProductionState 与 Studio v2 总览 / 右侧风险面板 / ShotScript 页错误文案，用户可直接看到镜头台本为什么被阻断。
- 小说分析质量 M13 已完成：Studio ShotScript 页生成入口已接入质量门槛，blocked / prerequisite_missing / not_evaluated 时禁用生成按钮并显示原因，避免用户点击后才看到 API 报错。
- Storyboard Legacy Interface Resolution 已完成：旧 structure storyboard generation 缺失最终分类为 C：预存缺口，不是当前 Phase 1A + M12/M13 diff 造成的 P0。
- 当前 diff 未导致 storyboard 缺失，未触碰 worker、旧 novel import、ProjectStructureResultsPanel、Prisma schema/migrations、auth/HMAC/JWT/permission guard。

## 进行中
- 提交前最终 smoke 与拆分提交准备。

## 未完成
- Storyboard image / video generation 继续隔离。
- Film IR、content gates、continuity、workers、shot planner 等高风险代码块继续隔离。
- Prisma migration 继续隔离。
- stash 中其他业务线改动仍需后续单独 milestone 消化。
- 暂不进入 Phase 1B，先完成当前 diff 的提交拆分和最终 smoke。

## 当前风险
- 当前 Phase 1A + M12/M13 改动可保留，不需要回滚。
- 不恢复 `refs/stash^3` 中的旧 storyboard generation 代码。
- 旧 ProjectStructureResultsPanel 继续保持 display-only。
- 分镜生成能力后续只进入 Studio v2 StoryboardEngine；除非单独开 Legacy storyboard generation compatibility milestone，否则不补旧 structure storyboard generation。
- 仍不能进入 storyboard image / video generation。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- M11 已能阻断明显低质量 ShotScript，但当前仍是规则驱动的最小导演/镜头文本，不等同于大厂级完整编剧、导演和分镜产线。
- 当前仍不生成 Storyboard 图片或视频资产。
- 旧 structure 页基线能力是展示已有 `resultImageUrl` / `Asset(type=IMAGE)`，不能被 Studio v2 替换，并继续 display-only；不要求旧 structure 页具备 storyboard generation。
- 只有未来单独启用 Legacy storyboard generation compatibility 时，才要求 `structure/storyboard-images` route、`project-storyboard-image.service` 和 ProjectStructureResultsPanel generate storyboard button。

## 验证状态
- `pnpm --filter api exec jest src/project/project-production-state.service.spec.ts src/project/project-studio-shot-script.service.spec.ts --runInBand` 通过，27 tests。
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit` 通过。
- `pnpm --filter web exec tsx src/features/studio-v2/studio-generation-blockers.test.ts` 通过。
- `pnpm --filter web exec tsx src/features/studio-v2/studio-state-summary.test.ts` 通过。
- `pnpm --filter web build` 通过。
- `git diff --check` 通过。
- `git status --short --untracked-files=all` 已检查。
- `git stash list --date=local | head -3` 已检查，未恢复 stash。

## 当前是否允许恢复新功能开发
no

## 原因
M12/M13 只完成质量门槛可见化与生成入口收口；图片、视频、worker 和 stash 仍需后续单独 milestone。当前先完成 Phase 1A + M12/M13 拆分提交和最终 smoke，不进入 Phase 1B。
