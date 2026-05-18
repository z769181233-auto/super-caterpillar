# 当前计划：小说分析质量 M6

## 目标
在不恢复 `stash@{0}`、不进入图片/视频生成的前提下，补齐小说分析质量链路的最小阻断能力：当 `coverageReport.sceneCandidates` 不足时，EpisodePlan / DirectorScript / ShotScript 不能继续伪生成，必须给出明确的覆盖率不足原因、阈值和 UI 提示。

## 请求流
用户在 Studio v2 页面触发生成剧集规划、导演剧本或镜头台本；Web 调用现有 Studio API；API 从项目 metadata、旧小说章节、`SceneDraft.analysisResult.coverageReport.sceneCandidates` 聚合输入；若输入不足则返回可读阻断错误，Web 展示阻断原因。

## 数据流
`NovelSource / Novel / SceneDraft.coverageReport.sceneCandidates` -> EpisodePlan sourceEvidence -> DirectorScript sourceEvidence -> ShotScript source evidence。M6 只补阻断与提示，不新增表、不改 worker、不改旧导入。

## 状态流
`sceneCandidates` 充足时保持现有生成；不足或 quality gate blocked 时进入明确 blocked 状态，由 UI 展示“需要重新跑小说分析质量链路”，不把旧摘要、旧 Episode 或旧 Shot 伪装为标准 Studio 产物。

## 修改边界
- 允许：EpisodePlan 覆盖率阻断原因、Studio v2 文本提示、相关测试、计划/状态文档。
- 禁止：恢复 `stash@{0}`、Prisma migration、worker 修改、旧 novel import 重构、图片生成、视频生成、批量格式化。

## Milestone M6 - Scene Candidate Coverage Blocker

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-episode-plan.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-episode-plan.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/StudioEpisodePlanPage.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/StudioDirectorScriptPage.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/StudioShotScriptPage.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/studio-generation-blockers.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/studio-generation-blockers.test.ts`

### 验收标准
- scene candidate 不足时 EpisodePlan 生成返回明确阻断原因。
- quality gate blocked 时不会回退旧 Episode 伪生成。
- UI 对 EpisodePlan / DirectorScript / ShotScript 生成失败展示中文阻断说明。
- 不触碰 `stash@{0}`。
- 现有旧导入、旧详情、旧结构链路不被修改。

### 验证命令
- `pnpm --filter api test -- project-studio-episode-plan.service.spec.ts project-studio-director-script.service.spec.ts project-studio-shot-script.service.spec.ts`
- `pnpm --filter web exec tsx src/features/studio-v2/studio-generation-blockers.test.ts`
- `pnpm --filter api typecheck`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `git diff --check`

### 当前状态
done
