# 当前计划：Common 导航文案 i18n display-only 切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆一个低风险 display-only 文案切片：补齐导航栏实际使用的 `Common.login` 与 `Common.enterWorkbench` 多语言文案，修复页面显示 `Common.login` / `Common.enterWorkbench` key 的问题。继续排除 storyboard image / video generation。

## 请求流
页面组件 `UserNav` / `StudioShell` 调用 `useTranslations('Common')` -> 读取 `apps/web/src/messages/*.json` -> 渲染登录与进入工作台文案。

## 数据流
无后端数据流。仅静态 i18n JSON -> Next/next-intl 消息读取 -> 前端只读展示。

## 状态流
没有生产状态变化、没有任务创建、没有 worker、没有图片或视频生成。

## 修改边界
- 允许：只修改 `apps/web/src/messages/{zh,en,vi}.json`、`PLANS.md`、`STATUS.md`。
- 禁止：恢复整包 stash、修改 auth 逻辑、修改项目创建/删除逻辑、修改 API/worker/CI/Prisma、接 storyboard image / video generation。

## Milestone Common Nav I18n Display Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/zh.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/en.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/vi.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- `Common.login` 三个 locale 均存在。
- `Common.enterWorkbench` 三个 locale 均存在。
- JSON 可解析。
- 不修改任何业务逻辑、API、worker、Prisma、CI。
- 不新增任何 storyboard image / video generation 入口。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `node - <<'NODE' ... JSON.parse + Common key assertion ... NODE`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/components/UserNav.tsx src/features/studio/components/StudioShell.tsx`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
