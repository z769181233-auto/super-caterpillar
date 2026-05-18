# STATUS

## 当前任务
小说分析质量 M6：覆盖率不足原因、scene candidate 阈值、Studio v2 阻断提示。

## 已完成
- 已完成前置 worktree hygiene，当前工作区从干净状态开始。
- 历史未归因改动已隔离在 `stash@{0}: hygiene-quarantine-remaining-dirty-2026-05-18`，本轮不恢复、不修改。
- 已确认 M6 不需要 Prisma migration，也不需要进入图片/视频生成。

## 进行中
- `stash@{0}` 专门消化 milestone 尚未开始。

## 未完成
- `stash@{0}` 专门消化 milestone。
- 图片分镜资产生成。
- 镜头级视频生成。
- 审片评分与回修闭环。

## 当前风险
- 如果小说分析质量输出没有足够 `sceneCandidates`，后续 EpisodePlan / DirectorScript / ShotScript 应阻断，而不是生成低质量伪结果。
- 当前 M6 只修阻断与提示，不提升人物/场景抽取算法本身。

## 已知问题
- 旧数据仍可能存在章节摘要、旧 Episode、旧 Shot，但不能直接等同于大厂级 Studio 产物。
- `stash@{0}` 仍待后续单独 milestone 分类处理。

## 验证状态
- lint: pass，目标文件无 error；既有 spec `any` 规则仍为 warning
- typecheck: pass
- unit tests: pass
- integration tests: not applicable
- build: pass via typecheck baseline
- smoke test: not applicable

## 当前是否允许恢复新功能开发
no

## 原因
M6 仍属于小说分析质量稳定化与阻断保护；图片/视频生成和更大 Studio 能力必须等输入质量链路稳定后再进入。
