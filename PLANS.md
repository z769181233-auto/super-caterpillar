# 当前计划：smoke studio receipt dry-run 脚本切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆一个安全的 smoke dry-run 脚本切片：读取既有 Studio receipt / 发布资产证据并输出摘要。继续排除 storyboard image / video generation。

## 请求流
开发者运行 `pnpm --filter api smoke:studio-receipt:dry-run` -> 脚本连接现有数据库 -> 只读查询最近可复用的 smoke publish/timeline 项目 -> 汇总 PublishedVideo / Asset / ShotJob 证据 -> 输出 JSON。

## 数据流
数据库已有 Project / PublishedVideo / Asset / ShotJob -> dry-run 聚合函数 -> 控制台 JSON。无写入、无服务启动、无 worker、无图片或视频生成。

## 状态流
存在可复用 smoke 项目则输出 `OK` 或 `WARN` 摘要；不存在基线则输出 `SKIPPED` 并以 0 退出。该脚本不创建项目、不创建任务、不补齐缺失资产。

## 修改边界
- 允许：新增一个 API scripts dry-run 文件、对应单测、package script、`PLANS.md` / `STATUS.md`。
- 禁止：恢复整包 stash、恢复会写库的 smoke 脚本、启动 API/Web/Worker、修改 Prisma、修改 CI workflow、修改 Film IR/content gates/continuity/workers/shot planner、接 storyboard image / video generation。

## Milestone Smoke Receipt Dry-Run

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/scripts/smoke-studio-receipt-dry-run.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/scripts/smoke-studio-receipt-dry-run.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/package.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- 新脚本只读，不自动 provision，不调用 `smoke:publish`，不启动服务。
- 找不到历史 smoke 数据时安全跳过，不返回失败。
- 单测覆盖空数据与有证据数据的聚合结果。
- 不新增任何 storyboard image / video generation 入口。
- 不做 Prisma migration。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `pnpm --filter api test -- smoke-studio-receipt-dry-run.spec.ts`
- `pnpm --filter api exec ts-node -r tsconfig-paths/register src/scripts/smoke-studio-receipt-dry-run.ts --sample`
- `pnpm --filter api exec eslint src/scripts/smoke-studio-receipt-dry-run.ts src/scripts/smoke-studio-receipt-dry-run.spec.ts`
- `pnpm --filter api typecheck`
- `pnpm --filter api build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
