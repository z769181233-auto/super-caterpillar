# 当前计划：小说分析质量 M6/M7 - Studio 阻断原因透传

## 目标
回到小说分析质量主线，做 M6/M7 极小切片：让 EpisodePlan / DirectorScript / ShotScript 生成失败时优先透传后端 `coverageReport.sceneCandidates` 阻断原因，并在 UI 上明确显示“小说分析质量门禁阻断”，避免用户误判为页面无响应或普通报错。继续排除 storyboard image / video generation。

## 请求流
Studio v2 页面点击生成按钮 -> `apps/web/src/features/studio-v2/api.ts` 调用 Next API 代理 -> API 返回 Nest 错误 JSON -> 前端解析错误原因 -> `formatStudioGenerationError` 展示可理解阻断提示。

## 数据流
后端 `BadRequestException` 的顶层 `message` / `error.message` -> 前端 API error extractor -> Studio 页面错误态。无数据库写入、无 worker、无图片或视频生成。

## 状态流
生成被阻断时不改变 Studio metadata；只显示阻断原因。成功路径保持现状。

## 修改边界
- 允许：`apps/web/src/features/studio-v2/api.ts`、新增/更新 studio-v2 纯函数测试与错误解析工具、`PLANS.md`、`STATUS.md`。
- 禁止：修改 novel import、EpisodePlan/DirectorScript/ShotScript 后端生成算法、worker、Prisma、CI、图片生成、视频生成、stash。

## Milestone M6/M7 Studio Blocker Propagation

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/api.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/studio-api-errors.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/features/studio-v2/studio-api-errors.test.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- Nest 顶层 `message` 能被前端生成 API 正确透传。
- `coverageReport.sceneCandidates` / `No usable scene candidates` / `scene candidate evidence` 阻断不会退化为 generic error。
- UI 现有 `formatStudioGenerationError` 能拿到真实阻断原因。
- 不修改图片/视频生成相关文件。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm exec tsx apps/web/src/features/studio-v2/studio-api-errors.test.ts`
- `pnpm exec tsx apps/web/src/features/studio-v2/studio-generation-blockers.test.ts`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/features/studio-v2/api.ts src/features/studio-v2/studio-api-errors.ts`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
