# 当前计划：display-only project-detail / structure UI 小切片

## 目标
从 `stash@{0}` 中只恢复项目详情与结构结果的展示型 UI 能力，让旧项目详情页可以通过 `?module=structure|script` 打开只读结构/视频剧本结果视图，同时继续排除 Storyboard image / video generation。

## 请求流
用户进入旧项目详情页或旧 `/structure` 别名页 -> `ProjectDetailShell` 根据 query module 选择只读 `script` tab -> `ProjectStructureResultsPanel` 调用现有 `projectApi.getProjectStructure(projectId)` -> 页面只展示现有 Episode / Scene / Shot / ProductionScript / resultImageUrl 状态。

## 数据流
现有后端 `/api/projects/:projectId/structure` -> `ProjectStructureTree` -> 前端只读派生：章节数、场景数、镜头数、角色文字卡、分集镜头列表、已有文字镜头脚本数量、已有图片资产数量。

## 状态流
无结构数据显示空态；只有小说分析结构时明确标记“还不是导演剧本/镜头台本”；已有 productionScript/镜头字段时显示为文字镜头脚本；已有 `resultImageUrl` 只作为现有资产展示，不触发生成。

## 修改边界
- 允许：项目详情 tab、旧结构页别名、只读结构结果面板、纯展示派生 helper、相关单测、必要 i18n 文案、`PLANS.md` / `STATUS.md`。
- 禁止：恢复任何 `storyboard-assets` / `storyboard-images` route、调用 `generateVideoScript`、调用 `generateStoryboardImages`、修改 worker、修改 Prisma、修改 novel import、接图片或视频生成。

## Milestone Display UI Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/app/[locale]/projects/[projectId]/structure/page.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/project-detail/ProjectDetailShell.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/project-detail/ProjectDetailOverview.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/project-detail/ProjectStructureResultsPanel.tsx`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/project-detail/project-detail-tabs.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/project-detail/project-production-breakdown.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/*.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 旧项目详情页仍可用。
- `/zh/projects/:projectId/structure` 重定向到旧详情页的 script tab。
- `/zh/projects/:projectId/?module=structure` 和 `?module=script` 能打开只读结构结果。
- 页面不出现任何“生成视频剧本 / 生成图片故事板”的触发按钮。
- 没有结构数据时显示空态，不报错。
- 有旧结构数据时显示章节、场景、镜头、角色文字卡和分集镜头列表。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter web exec tsx src/features/project-detail/project-detail-tabs.test.ts`
- `pnpm --filter web exec tsx src/features/project-detail/project-production-breakdown.test.ts`
- `pnpm --filter web exec tsx src/features/project-detail/api.test.ts`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/features/project-detail/ProjectDetailShell.tsx src/features/project-detail/ProjectDetailOverview.tsx src/features/project-detail/ProjectStructureResultsPanel.tsx src/features/project-detail/project-detail-tabs.ts src/features/project-detail/project-detail-tabs.test.ts src/features/project-detail/project-production-breakdown.ts src/features/project-detail/project-production-breakdown.test.ts`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
