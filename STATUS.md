# STATUS

## 当前任务
stash@{0} auth/security 小切片。

## 已完成
- `stash@{0}` 已完成只读 inventory：`98a59074a chore: document quarantined stash inventory`。
- 已确认当前工作区从 clean HEAD 开始。
- 已确认本轮只处理 2 个 auth/security 路径，不恢复 Storyboard image / video generation。

## 进行中
- 等待下一个 stash restore milestone。

## 未完成
- display-only project-detail / structure UI stash slice。
- asset receipt / review evidence stash slice。
- Storyboard image / video generation 继续隔离。
- Prisma migration 继续隔离。

## 当前风险
- 组织 header fallback 必须保持在 `apiKeyOwnerOrgId` 和 `user.organizationId` 之后，避免覆盖已认证组织上下文。
- 不能用 `git stash pop/apply` 恢复整包。

## 已知问题
- `stash@{0}` 仍包含大量互相耦合的历史改动，后续必须继续按业务线拆分。

## 验证状态
- auth guard tests: pass
- lint: pass，目标文件无 error；既有 `any` / unused import 规则仍为 warning
- typecheck: pass
- diff check: pass
- stash preservation check: pass

## 当前是否允许恢复新功能开发
no

## 原因
当前仍处于 hygiene/安全小切片恢复阶段，不应恢复图片、视频或大范围 Studio 新功能。
