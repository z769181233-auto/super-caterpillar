# STATUS

## 当前任务
display-only project-detail / structure UI 小切片。

## 已完成
- `stash@{0}` 已完成只读 inventory：`98a59074a chore: document quarantined stash inventory`。
- auth/security 小切片已单独提交：`d17451558 fix(auth): align budget guard organization context`。
- 本轮已确认 stash 中原 `ProjectStructureResultsPanel` 含 `generateVideoScript` / `generateStoryboardImages` 调用，不能原样恢复。
- 已恢复 display-only project-detail / structure UI 小切片：只读 `script` tab、旧结构页别名、结构结果展示面板、角色文字线索、分集镜头列表。

## 进行中
- 等待下一个 hygiene milestone。

## 未完成
- asset receipt / review evidence stash slice。
- Storyboard image / video generation 继续隔离。
- Prisma migration 继续隔离。
- 图片生成、视频生成、worker 生产链路不在本轮范围内。

## 当前风险
- 必须避免把旧小说分析摘要伪装成完整导演剧本或镜头台本。
- 必须避免恢复任何可触发图片/视频生成的按钮和 API route。
- `stash@{0}` 仍包含多业务线历史改动，不能 `git stash pop/apply` 整包恢复。

## 已知问题
- 当前结构页只能展示已有旧结构数据；真实 StoryBible / CharacterBible / LocationBible / ShotScript / StoryboardAsset 生成能力仍需要后续独立 milestone。

## 验证状态
- project-detail-tabs test: pass
- project-production-breakdown test: pass
- project-detail api test: pass
- web typecheck: pass
- target eslint: pass
- web build: pass
- JSON parse check: pass
- diff check: pass
- stash preservation check: pass

## 当前是否允许恢复新功能开发
no

## 原因
当前仍处于 hygiene 小切片恢复阶段，只恢复展示层，不进入图片、视频或大范围 Studio 新功能。
