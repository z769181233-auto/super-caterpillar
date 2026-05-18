# STATUS

## 当前任务
stash@{0} 专门消化 M1：inventory / risk buckets。

## 已完成
- 小说分析质量 M6 已提交：`f4928df79 fix(studio): surface scene candidate coverage blockers`。
- 当前工作区以 clean HEAD 为基线开始处理 stash。

## 进行中
- 等待下一个 stash restore milestone。

## 未完成
- `stash@{0}` 具体业务切片恢复。
- auth/security 单独恢复与验证。
- safe project-detail/structure UI 单独恢复与验证。
- asset receipt / review evidence 单独恢复与验证。
- Storyboard image / video generation 继续隔离。

## 当前风险
- `stash@{0}` 包含 155 个文件、约 3.7 万行新增，不能整包恢复。
- stash 中混有 CI、Prisma migration、worker、Storyboard 图片、视频/shot 生成、Studio UI、auth/security，多业务线耦合会造成不可 review 和回归风险。

## 已知问题
- stash 中的 `PLANS.md` / `STATUS.md` 是历史大文档，不能覆盖当前状态文档。
- stash 中的图片/视频生成相关内容仍不应进入当前主线。

## 验证状态
- stash inventory: pass
- worktree clean check: pass
- stash preservation check: pass

## 当前是否允许恢复新功能开发
no

## 原因
先完成 stash hygiene，避免再次把多条未验证业务线混成一个巨大 dirty 工作区。
