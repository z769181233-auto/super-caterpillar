# 当前计划：remaining stash risk ledger 文档切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`。本轮只做低风险 spec/display 文档切片：基于当前 HEAD 与 `stash@{0}` 的剩余差异，更新 stash hygiene inventory，明确当前剩余内容中哪些不应被当作低风险切片恢复。继续排除 storyboard image / video generation。

## 请求流
开发者查看 `docs/audits/stash_0_hygiene_inventory_2026-05-18.md` -> 确认已拆提交与剩余风险 -> 决定下一 milestone 是否继续 hygiene 或回到小说分析质量。

## 数据流
`git stash show -u --name-status stash@{0}` / `git diff HEAD stash@{0}` 输出 -> 手工分类 -> 文档记录。无运行时数据流。

## 状态流
只更新文档与状态记录；不创建任务、不启动 worker、不改变项目生产状态、不生成图片或视频。

## 修改边界
- 允许：只修改 `docs/audits/stash_0_hygiene_inventory_2026-05-18.md`、`PLANS.md`、`STATUS.md`。
- 禁止：恢复整包 stash、修改业务代码、修改 API/worker/CI/Prisma、修改登录/项目创建删除、接 storyboard image / video generation。

## Milestone Remaining Stash Risk Ledger Docs Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/audits/stash_0_hygiene_inventory_2026-05-18.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 文档记录 ProjectDetail i18n display-only 已拆提交。
- 文档记录当前剩余 stash 的低风险候选复核结论。
- 文档明确 storyboard image / video generation、CI、Prisma、worker、Film IR 仍不能混恢复。
- 不修改任何业务逻辑、API、worker、Prisma、CI。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`
- `git diff --name-status HEAD 'stash@{0}' -- docs apps/web/src/features apps/web/src/app apps/api/src apps/workers/src packages/shared-types .github packages/database/prisma | sed -n '1,220p'`

### 当前状态
done
