# 当前计划：小说分析质量 M7 - scene candidate 覆盖率风险接入 ProductionState

## 目标
继续小说分析质量主线，只做 M7 极小切片：把已有 `SceneDraft.analysisResult.coverageReport.sceneCandidates` 的覆盖率不足原因聚合进 `GET /projects/:projectId/production-state`，并在 Studio v2 总览 / 右侧风险面板明确展示。继续排除 storyboard image / video generation。

## 请求流
Studio v2 页面加载 -> `getStudioProductionState(projectId)` -> API 聚合旧 Novel / SceneDraft coverageReport -> 返回 `riskFlags`、`nextActions`、`legacyDataSummary` -> Studio 总览和右侧面板显示覆盖率不足原因。

## 数据流
`SceneDraft.analysisResult.coverageReport` -> ProductionState coverage summary -> `riskFlags` / `nextActions` / `legacyDataSummary.sceneCandidateCoverage` -> Studio v2 UI。无数据库写入、无 worker、无图片或视频生成。

## 状态流
只读生产状态聚合；不改变 Project.metadata、不改变 NovelAnalysisJob、不改变旧 Episode/Scene/Shot、不启动任何生成任务。

## 修改边界
- 允许：`packages/shared-types/src/animation-studio.ts`、`apps/api/src/project/project-production-state.service.ts`、对应 service 测试、Studio v2 总览/右侧面板/summary 测试、`PLANS.md`、`STATUS.md`。
- 禁止：修改 novel import、Studio 生成算法、worker、Prisma schema/migration、CI、图片生成、视频生成、stash。

## Milestone M7 ProductionState Scene Candidate Risk

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/packages/shared-types/src/animation-studio.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-production-state.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-production-state.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/StudioOverviewPage.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/StudioRightPanel.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/studio-state-summary.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/studio-state-summary.test.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- ProductionState 能返回 scene candidate 覆盖率摘要。
- sceneCandidates 缺失或低于章节数时，`riskFlags` 明确提示不足原因。
- Studio 总览和右侧风险面板能显示场景候选覆盖率。
- 不修改图片/视频生成相关文件。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter api exec jest src/project/project-production-state.service.spec.ts --runInBand`
- `pnpm exec tsx apps/web/src/features/studio-v2/studio-state-summary.test.ts`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/features/studio-v2/StudioOverviewPage.tsx src/features/studio-v2/StudioRightPanel.tsx src/features/studio-v2/studio-state-summary.ts`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
