# 当前计划：overview proxy / API base 只读 display-spec 切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆出不涉及生成链路的 Web display/spec 基础设施：项目 overview 只读代理路由、API base server fallback、代理 env fallback 与对应测试。继续排除 storyboard image / video generation。

## 请求流
旧项目详情页调用 `/api/projects/:projectId/overview/` -> Next route handler 透传 cookie/authorization -> 后端 `/api/projects/:projectId/overview` -> 前端只读展示项目总览、任务、审计证据。

## 数据流
浏览器请求携带 cookie -> Next API route `extractForwardHeaders` -> `buildApiUrl` 生成后端绝对 URL -> 后端返回 JSON 原样透传。签名代理相关 env 读取仅增加 fallback 文件查找，不改变导入小说接口协议。

## 状态流
无后端返回时保持原状态码与响应体透传；不生成、不重跑、不写数据库。server runtime 无显式 API base 时 fallback 到 `http://127.0.0.1:3000`，避免 route handler 使用相对 URL 触发 fetch 失败。

## 修改边界
- 允许：新增 overview 只读代理 route/test、`api-base` server fallback/test、`novel-import-proxy` env fallback/test、`PLANS.md` / `STATUS.md`。
- 禁止：恢复 storyboard-assets/storyboard-images route、调用图片/视频生成、修改 worker、修改 Prisma、修改后端业务服务、修改旧 novel import 协议。

## Milestone Overview Proxy Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/app/api/projects/[projectId]/overview/route.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/app/api/projects/[projectId]/overview/route.test.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/lib/api-base.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/lib/api-base.test.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/lib/server/novel-import-proxy.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/lib/server/novel-import-proxy.test.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- `/api/projects/:projectId/overview` Next 代理存在并透传 cookie。
- server runtime 下 `buildApiUrl('/api/projects')` 返回绝对 URL。
- browser runtime 仍允许同源相对请求。
- 签名代理可以从 fallback `.env` 文件读取 `WORKER_API_KEY` / `HMAC_SECRET_KEY` 等环境变量。
- 不新增任何 storyboard image / video generation route。
- 不做 Prisma migration。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter web exec tsx src/lib/api-base.test.ts`
- `pnpm --filter web exec tsx src/lib/server/novel-import-proxy.test.ts`
- `pnpm --filter web exec tsx src/app/api/projects/[projectId]/overview/route.test.ts`
- `pnpm --filter web exec tsx src/features/project-detail/api.test.ts`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/lib/api-base.ts src/lib/api-base.test.ts src/lib/server/novel-import-proxy.ts src/lib/server/novel-import-proxy.test.ts src/app/api/projects/[projectId]/overview/route.ts src/app/api/projects/[projectId]/overview/route.test.ts`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
