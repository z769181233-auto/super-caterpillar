# 当前计划：ProjectDetail i18n display-only 切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆一个低风险 display-only 文案切片：手工挑选剩余 messages diff 中的 ProjectDetail 安全文案，让旧项目详情页更明确显示“视频剧本 / 小说分析状态 / 下一步说明”。继续排除 storyboard image / video generation。

## 请求流
项目详情页组件调用 `useTranslations('ProjectDetail')` -> 读取 `apps/web/src/messages/*.json` -> 渲染项目详情、小说分析状态和入口按钮文案。

## 数据流
无后端数据流。仅静态 i18n JSON -> Next/next-intl 消息读取 -> 前端只读展示。

## 状态流
没有生产状态变化、没有任务创建、没有 worker、没有图片或视频生成。

## 修改边界
- 允许：只修改 `apps/web/src/messages/{zh,en,vi}.json` 的 `ProjectDetail` 段落、`PLANS.md`、`STATUS.md`。
- 禁止：修改 `Auth` 文案缩进/逻辑、修改 `Projects` 创建删除文案和逻辑、修改项目详情组件、修改 API/worker/CI/Prisma、接 storyboard image / video generation。

## Milestone ProjectDetail I18n Display Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/zh.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/en.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/web/src/messages/vi.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 三个 locale JSON 可解析。
- `ProjectDetail.navScript` / `ctaOpenScriptResults` 使用视频剧本语义。
- 小说分析状态下一步说明更清晰，但不伪造生成能力。
- 不修改任何业务逻辑、API、worker、Prisma、CI。
- 不新增任何 storyboard image / video generation 入口。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `node - <<'NODE' ... ProjectDetail key assertion ... NODE`
- `pnpm --filter web exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web exec eslint src/features/project-detail/ProjectDetailOverview.tsx src/features/project-detail/ProjectDetailShell.tsx`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
