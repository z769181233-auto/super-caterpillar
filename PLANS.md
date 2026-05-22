# 当前计划：小说分析质量 M9 - scene candidate 前置校验稳定化

## 目标
继续小说分析质量主线，只做 M9 极小切片：把 `coverageReport.sceneCandidates` 转成 EpisodePlan / DirectorScript / ShotScript 的稳定输入证据，并在证据不足时明确阻断。继续排除 storyboard image / video generation。

## 请求流
Studio v2 生成请求 -> EpisodePlan 读取 SceneDraft coverageReport.sceneCandidates -> 生成带结构化 evidence 的 EpisodePlan -> DirectorScript 校验并消费 evidence -> ShotScript 校验并消费 evidence。

## 数据流
SceneDraft.analysisResult.coverageReport.sceneCandidates -> scene-candidate evidence string -> EpisodePlan.sourceEvidence -> DirectorScript.sourceEvidence -> ShotScript.source_evidence。无图片、无视频、无 Prisma migration。

## 状态流
只影响 Studio v2 metadata 中 EpisodePlan / DirectorScript / ShotScript 的生成前置校验与 evidence 内容；不改变旧小说导入、旧结构页、worker 执行链路或数据库 schema。

## 修改边界
- 允许：`apps/api/src/project/project-studio-episode-plan.service.ts`、`apps/api/src/project/project-studio-director-script.service.ts`、`apps/api/src/project/project-studio-shot-script.service.ts`、相关 spec、可复用 evidence 小工具、`PLANS.md`、`STATUS.md`。
- 禁止：修改图片生成、视频生成、Storyboard image、Prisma schema/migration、旧 novel import、worker 执行链路、stash。

## Milestone M9 Stable Scene Candidate Preconditions

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-scene-candidate-evidence.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-episode-plan.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-director-script.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-shot-script.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-episode-plan.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-director-script.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-shot-script.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- EpisodePlan 只能从 medium/high 且包含可追踪文本、人物/地点/动作/对白证据的 sceneCandidates 生成。
- EpisodePlan.sourceEvidence 必须包含 candidate id、confidence、source blocks、人物、地点、对白/动作索引、text。
- DirectorScript 不能只凭旧摘要或残缺 `scene-candidate:` 字符串继续生成。
- ShotScript 不能只凭旧摘要或残缺 `scene-candidate:` 字符串继续生成。
- 阻断错误要明确说明缺什么，以及下一步需要重新跑小说分析质量管线。
- 不接图片/视频生成，不做 migration，不恢复 stash。

### 验证命令
- `pnpm --filter api exec jest src/project/project-studio-episode-plan.service.spec.ts src/project/project-studio-director-script.service.spec.ts src/project/project-studio-shot-script.service.spec.ts --runInBand`
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
