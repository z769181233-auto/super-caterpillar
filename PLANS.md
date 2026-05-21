# 当前计划：stash remaining low-risk candidate evaluation 文档切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只做一个纯文档评估切片：基于当前 HEAD 与 `stash@{0}` 的差异，更新 stash inventory，明确哪些剩余内容仍不适合直接恢复，避免后续误把高风险块混入提交。继续排除 storyboard image / video generation。

## 请求流
开发者查看 `docs/audits/stash_0_hygiene_inventory_2026-05-18.md` -> 根据已提交切片和剩余 stash 差异选择下一 milestone。

## 数据流
`git diff HEAD stash@{0}` / `git stash show` 输出 -> 手工归类 -> 文档记录。无代码运行时数据流。

## 状态流
只更新文档状态；不修改项目生产状态、不启动 worker、不创建任务、不生成图片或视频。

## 修改边界
- 允许：只修改 `docs/audits/stash_0_hygiene_inventory_2026-05-18.md`、`PLANS.md`、`STATUS.md`。
- 禁止：恢复整包 stash、修改业务代码、修改测试代码、修改 API/worker/CI/Prisma、接 storyboard image / video generation。

## Milestone Remaining Stash Evaluation Docs Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/audits/stash_0_hygiene_inventory_2026-05-18.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 文档记录已从 stash 拆出的提交。
- 文档记录当前剩余低风险候选评估。
- 文档明确继续隔离 storyboard image / video generation。
- 不修改任何业务逻辑、测试、API、worker、Prisma、CI。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
