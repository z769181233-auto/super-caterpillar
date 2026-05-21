# 当前计划：Director Layer acceptance registry spec 切片

## 目标
继续 hygiene，不恢复整包 `stash@{0}`，只拆一个低风险 spec 切片：更新 `DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json`，把当前严格闭环验收 profile 锁定到已验证通过的最小单 scene 样本，避免验收脚本继续退化到 `FALLBACK_LATEST`。继续排除 storyboard image / video generation。

## 请求流
开发者运行 Director Layer acceptance/report 脚本 -> 脚本读取 `docs/_specs/DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json` -> 使用默认 profile 的 sceneIds 作为只读验收目标。

## 数据流
静态 JSON registry -> acceptance/report 脚本读取 sceneIds -> 查询已有数据库场景。该切片不写库、不创建任务、不启动 worker、不生成图片或视频。

## 状态流
registry version 从 5 更新到 6；默认 profile 的目标 sceneIds 从 7 个历史样本收敛为 1 个已验证最小样本。没有生产状态变化。

## 修改边界
- 允许：只修改 `docs/_specs/DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json`、`PLANS.md`、`STATUS.md`。
- 禁止：恢复整包 stash、修改 Film IR 服务/脚本逻辑、修改 shot planner/content gates/continuity/workers、修改 Prisma、修改 CI、接 storyboard image / video generation。

## Milestone Director Layer Registry Spec Slice

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_specs/DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- registry JSON 可解析。
- `version` 为 6。
- `defaultProfile` 指向存在的 profile。
- 默认 profile 至少包含 1 个 UUID 格式 sceneId。
- 不修改任何业务逻辑、API、worker、Prisma、CI。
- 不新增任何 storyboard image / video generation 入口。
- `stash@{0}` 不被 pop/drop。

### 验证命令
- `node - <<'NODE' ... DIRECTOR_LAYER_ACCEPTANCE_REGISTRY schema assertion ... NODE`
- `pnpm --filter api typecheck`
- `pnpm --filter api build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
