# CI Latest Status (Pre-Phase 3 Patch)

- **Workflow**: `ci`
- **Run ID**: `22799786220` (基于最新 failing run #110 取证及本地无 `.env` 重放确认)
- **Head SHA**: `3d1f93c5d642e0571f061266858276f5713be217`
- **Failed Job**: `ci`
- **Failed Step**: `Turbo test` -> `api#test`
- **结论**: `Failure`

导致远端及本地无 `.env` 测试用例失败的错误全部集中在 `apps/api` 的几处脱节的单测 Mock 实例化和测试环境参数残缺。属于隔离的测试层异常，不涉及运行时问题。
