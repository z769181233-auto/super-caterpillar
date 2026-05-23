# 当前计划：Phase 1A + M12/M13 收口提交准备

## 目标
停止新增功能，只对当前 Phase 1A + M12/M13 diff 做提交前收口。根据 Storyboard Legacy Interface Resolution，旧 structure storyboard generation 缺失最终分类为 C：预存缺口，不是当前 diff 造成的 P0。本轮只更新计划 / 状态文档并执行最终 smoke，不恢复 stash，不补旧 storyboard generation，不进入 Phase 1B。

## 请求流
当前只读审计链路：读取 `docs/audits/phase_1a_current_status_review.md`、`docs/audits/phase_1a_legacy_smoke_review.md`、`docs/audits/storyboard_legacy_interface_resolution.md` -> 更新 `PLANS.md` / `STATUS.md` 的最终决策 -> 运行提交前验证命令 -> 输出拆分提交建议。

## 数据流
不新增数据流，不修改业务数据。当前 diff 保留 ProductionState / Studio v2 quality gate 可视化与 ShotScript 生成入口收口；storyboard 旧接口缺失只记录为预存产品缺口。

## 状态流
状态文档明确：当前 diff 没有触碰 worker、旧 novel import、ProjectStructureResultsPanel、Prisma schema/migrations、auth/HMAC/JWT/permission guard。旧 ProjectStructureResultsPanel 继续保持 display-only。

## 修改边界
- 允许：`PLANS.md`、`STATUS.md`。
- 禁止：`apps/api/**`、`apps/web/**`、`apps/workers/**`、`packages/database/**`、`packages/shared-types/**` 业务代码改动。
- 禁止：Prisma migration、旧 novel import、worker、Storyboard image、video generation、stash、全仓格式化、PR、commit。

## Milestone Submit Prep - Phase 1A + M12/M13

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- Storyboard legacy interface 最终分类写清楚：C 预存缺口。
- 当前 diff 没有导致 storyboard 缺失，且不需要回滚 Phase 1A + M12/M13。
- 不恢复 `refs/stash^3` 中的旧 storyboard generation 代码。
- 旧 ProjectStructureResultsPanel 保持 display-only。
- 分镜生成能力后续只进入 Studio v2 StoryboardEngine；除非单独开 Legacy storyboard generation compatibility milestone，否则不补旧 structure storyboard generation。
- 暂不进入 Phase 1B，先完成提交拆分和最终 smoke。

### 旧 structure storyboard smoke 基线
- 必须能展示已有 `resultImageUrl` / `Asset(type=IMAGE)`。
- 必须不能被 Studio v2 替换。
- 必须继续 display-only。
- 不要求旧 structure 页具备 storyboard generation。
- 只有未来单独启用 Legacy storyboard generation compatibility 时，才要求 `structure/storyboard-images` route、`project-storyboard-image.service`、ProjectStructureResultsPanel generate storyboard button。

### 验证命令
- `git status --short`
- `git diff --stat`
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web lint`
- `pnpm --filter api exec jest src/project/project-production-state.service.spec.ts src/novel-import/novel-import.controller.spec.ts src/project/project-video-script.service.spec.ts --runInBand`
- `pnpm --filter web build`

### 当前状态
doing
