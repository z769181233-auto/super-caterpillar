# 当前计划：小说分析质量 M11 - 文本质量门槛

## 目标
继续小说分析质量主线，只做 M11 极小切片：把固定样例验收扩展为 ShotScript 文本质量门槛。质量不过关时明确失败，不继续写入低质量镜头台本。继续排除 storyboard image / video generation。

## 请求流
Studio v2 ShotScript 生成请求 -> DirectorScript.sourceEvidence -> sceneCandidates -> 构造 ShotScript -> 文本质量门槛校验 -> 通过才写入 Project.metadata。

## 数据流
scene-candidate evidence -> ShotScript 镜头文本 -> 质量门槛统计：镜头数量、对白抽取率、角色绑定率、场景绑定率、占位文本、每镜头 evidence 绑定率。无图片、无视频、无 Prisma migration。

## 状态流
只影响 Studio v2 ShotScript 文本生成后的写入前校验；不改变旧小说导入、旧结构页、worker 执行链路或数据库 schema。

## 修改边界
- 允许：`apps/api/src/project/project-studio-shot-script.service.ts`、相关 ShotScript / 文本链路 spec、`PLANS.md`、`STATUS.md`。
- 禁止：修改图片生成、视频生成、Storyboard image、Prisma schema/migration、旧 novel import、worker 执行链路、stash。

## Milestone M11 ShotScript Text Quality Gate

### 范围
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-shot-script.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-shot-script.service.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/project/project-studio-text-pipeline.acceptance.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/PLANS.md`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/STATUS.md`

### 验收标准
- ShotScript 少于 4 个镜头时阻断。
- 对白抽取率低于 50% 时阻断，不能全靠生成式占位反应。
- 角色绑定率低于 100% 时阻断。
- 场景绑定率低于 100% 时阻断。
- 任一镜头缺失 source_evidence / scene-candidate 时阻断。
- 任一镜头出现“待编剧精修 / 旧摘要 / 未生成 / 待识别 / 待定场景”等占位文本时阻断。
- 固定《表姑娘又又又又跑了》样例仍能通过。
- 不接图片/视频生成，不做 migration，不恢复 stash。

### 验证命令
- `pnpm --filter api exec jest src/project/project-studio-text-pipeline.acceptance.spec.ts src/project/project-studio-shot-script.service.spec.ts --runInBand`
- `pnpm --filter api exec jest src/project/project-studio-episode-plan.service.spec.ts src/project/project-studio-director-script.service.spec.ts src/project/project-studio-shot-script.service.spec.ts --runInBand`
- `pnpm --filter api exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter web build`
- `git diff --check`
- `git status --short --untracked-files=all`
- `git stash list --date=local | head -3`

### 当前状态
done
