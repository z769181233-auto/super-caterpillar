# 当前计划：stash@{0} 专门消化 M1

## 目标
把 `stash@{0}: hygiene-quarantine-remaining-dirty-2026-05-18` 从“不可见的大包风险”变成可追踪、可拆分、可验证的 inventory。当前 milestone 不 `pop`、不整包提交、不进入图片/视频生成，只做清单固化和后续拆分策略。

## 请求流
当前 clean HEAD -> 只读检查 `stash@{0}` -> 统计文件与业务线 -> 输出 inventory 文档 -> 更新状态 -> 验证当前工作区仍干净、stash 仍存在。

## 数据流
`git stash show -u --name-status stash@{0}` 和 `git stash show -u --stat stash@{0}` -> `docs/audits/stash_0_hygiene_inventory_2026-05-18.md`。不把 stash 内容恢复进工作区。

## 状态流
`stash pending` -> `inventory documented`。后续每个业务线必须单独恢复、单独验证、单独提交。

## 修改边界
- 允许：新增 stash inventory 文档，更新 `PLANS.md` / `STATUS.md`。
- 禁止：`git stash pop`、`git stash apply`、删除 stash、恢复图片/视频生成、恢复 Prisma migration、整包提交 155 个文件。

## Milestone Stash M1 - Inventory / Risk Buckets

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/audits/stash_0_hygiene_inventory_2026-05-18.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 已记录 stash 文件总量、主要业务线、风险等级。
- 已明确哪些切片可优先恢复，哪些必须继续隔离。
- 当前工作区不混入 stash 内容。
- `stash@{0}` 仍保留，未被 pop/drop。

### 验证命令
- `git stash show -u --name-status stash@{0}`
- `git stash show -u --stat stash@{0}`
- `git status --short`
- `git stash list --date=local | head -3`
- `git diff --check`

### 当前状态
done
