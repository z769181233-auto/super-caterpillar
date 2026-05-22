# 当前计划：小说分析质量 M10 - 文本产物端到端验收

## 目标
继续小说分析质量主线，只做 M10 极小切片：用固定《表姑娘又又又又跑了》样例验收 `sceneCandidates -> EpisodePlan -> DirectorScript -> ShotScript` 文本产物，确认输出是可拍摄的动漫制作文本，而不是章节摘要或占位文本。继续排除 storyboard image / video generation。

## 请求流
Studio v2 文本生成请求 -> EpisodePlan 消费 SceneDraft coverageReport.sceneCandidates -> DirectorScript 消费 EpisodePlan.sourceEvidence -> ShotScript 消费 DirectorScript.sourceEvidence -> API metadata 只读/写入项目 metadata。

## 数据流
固定样例 sceneCandidates -> 稳定 scene-candidate evidence -> EpisodePlan 剧集目标/情绪/爽点/钩子 -> DirectorScript 场次节奏 -> ShotScript 镜头级时长、景别、运镜、动作、对白/旁白、光影、提示词。无图片、无视频、无 Prisma migration。

## 状态流
只影响 Studio v2 文本层产物质量与回归测试；不改变旧小说导入、旧结构页、worker 执行链路或数据库 schema。

## 修改边界
- 允许：`apps/api/src/project/project-studio-shot-script.service.ts`、新增/更新 Studio 文本链路 spec、`PLANS.md`、`STATUS.md`。
- 禁止：修改图片生成、视频生成、Storyboard image、Prisma schema/migration、旧 novel import、worker 执行链路、stash。

## Milestone M10 Text Pipeline Acceptance

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-shot-script.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-text-pipeline.acceptance.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-shot-script.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 固定样例能串联生成 EpisodePlan、DirectorScript、ShotScript。
- EpisodePlan 必须来自 sceneCandidates evidence，不允许旧摘要替代。
- DirectorScript 必须包含可追踪 scene-candidate 场次。
- ShotScript 必须至少生成 4 个镜头，并包含镜头时长、景别、运镜、人物动作、对白或旁白、音效、光影、情绪、storyboard_prompt、video_prompt。
- ShotScript 不允许出现“待编剧精修”这类占位文本。
- ShotScript 的每个镜头必须绑定 source_evidence，不允许脱离 sceneCandidates。
- 不接图片/视频生成，不做 migration，不恢复 stash。

### 验证命令
- `pnpm --filter api exec jest src/project/project-studio-text-pipeline.acceptance.spec.ts src/project/project-studio-shot-script.service.spec.ts --runInBand`
- `pnpm --filter api exec jest src/project/project-studio-episode-plan.service.spec.ts src/project/project-studio-director-script.service.spec.ts src/project/project-studio-shot-script.service.spec.ts --runInBand`
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
