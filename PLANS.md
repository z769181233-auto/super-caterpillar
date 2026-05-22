# 当前计划：小说分析质量 M8 - scene candidate 召回根因修复

## 目标
继续小说分析质量主线，只做 M8 极小切片：修复单换行小说文本被当成一个大段落导致 scene candidate 颗粒度不足的问题，并补强无引号对白 / 动作块召回。继续排除 storyboard image / video generation。

## 请求流
小说导入后触发章节分析 -> `NovelAnalysisProcessorService.analyzeChapter` -> 段落/句子切分 -> `buildChapterSemanticContext` / `buildNovelAnalysisCoverageReport` -> 持久化 `SceneDraft.analysisResult.coverageReport`。

## 数据流
章节 rawContent -> 更细段落/句子块 -> 人物/地点/对白/动作块抽取 -> sceneCandidates -> qualityGate。无图片、无视频、无 Prisma migration。

## 状态流
只影响后续新分析任务写入的 SceneDraft coverageReport；不改变 Project.metadata、不启动 worker、不生成 StoryboardAsset 或 VideoJob。

## 修改边界
- 允许：`packages/shared-types/src/scene-semantics.ts`、`apps/api/src/novel-import/novel-analysis-processor.service.ts`、对应 API/worker 回归测试、`PLANS.md`、`STATUS.md`。
- 禁止：修改 Studio 生成算法、worker 执行链路、Prisma schema/migration、CI、图片生成、视频生成、stash。

## Milestone M8 Scene Candidate Recall

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/packages/shared-types/src/scene-semantics.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/novel-import/novel-analysis-processor.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/novel-import/novel-analysis-processor.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/jest.config.js`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 单换行章节不会被合并成一个大段落。
- 无空行的连续小说正文也能按句子形成可追踪 scene candidates。
- 无引号对白和短动作句能进入 coverageReport。
- 固定《表姑娘又又又又跑了》样本继续通过，并提升 scene candidate 颗粒度。
- 不修改图片/视频生成相关文件。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter api exec jest src/novel-import/novel-analysis-processor.service.spec.ts --runInBand`
- `pnpm --filter @scu/worker exec jest src/novel-analysis-processor.spec.ts --runInBand`
- `pnpm --filter @scu/shared-types build`
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
