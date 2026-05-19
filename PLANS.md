# 当前计划：project structure 只读代理切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆出旧结构结果页所需的只读 Web 代理：`GET /api/projects/:projectId/structure`。继续排除 storyboard image / video generation。

## 请求流
旧项目详情页或结构页调用 `/api/projects/:projectId/structure` -> Next route handler 透传 cookie/authorization -> 后端 `/api/projects/:projectId/structure` -> 返回现有结构树 JSON，用于只读展示章节、场景、镜头和已有文本结构。

## 数据流
浏览器请求携带 cookie -> `extractForwardHeaders` -> `buildApiUrl` 生成后端 URL -> 后端结构接口响应原样透传。无写入、无生成、无 worker。

## 状态流
后端返回成功则原样透传结构数据；后端返回错误则原样保留状态码和响应体。该代理不创建任务、不重跑分析、不生成分镜图或视频。

## 修改边界
- 允许：新增 structure 只读代理 route/test、`PLANS.md` / `STATUS.md`。
- 禁止：恢复 `/structure/storyboard-images`、恢复 `storyboard-assets/**`、调用图片/视频生成、修改 worker、修改 Prisma、修改后端业务服务。

## Milestone Structure Proxy Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/app/api/projects/[projectId]/structure/route.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/app/api/projects/[projectId]/structure/route.test.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- `/api/projects/:projectId/structure` Next 代理存在并透传 cookie。
- 代理只使用 `GET`，不提供生成或重跑操作。
- 不新增任何 storyboard image / video generation route。
- 不做 Prisma migration。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter web exec tsx src/app/api/projects/[projectId]/structure/route.test.ts`
- `pnpm --filter web exec tsx src/features/project-detail/api.test.ts`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/app/api/projects/[projectId]/structure/route.ts src/app/api/projects/[projectId]/structure/route.test.ts`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
