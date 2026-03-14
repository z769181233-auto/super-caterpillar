# CI Minimal Fix Manifest

| file changed | exact fix | why needed | risk | affects runtime? |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | `env` 区块补充 `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SHOT_RENDER_PROVIDER` 的哑数据(dummy values) | CI 执行 `Turbo test` 期间，不存在 `.env` 或 `.env.local`。某些 Service 因为校验严格报错退出。 | Low | **NO** |
| `apps/api/src/engines/adapters/__tests__/ce07_memory_update.spec.ts` | 将 `new AuditService(prisma)` 替换为 `{ log: jest.fn() }` 这一 Mock 实例 | 通过测试层解除关联业务代码调用的耦合，消除 `is not a function` 错误。 | Low | **NO** |
| `apps/api/src/task/task-graph.controller.spec.ts` | 为 `mockPrismaService` 增加 `$disconnect: jest.fn()` | Nest Module 销毁并执行 `onModuleDestroy()` 时抛出了引用未定义。 | Low | **NO** |
| `apps/api/src/engine-profile/engine-profile.service.spec.ts` | 同理，为 `providers` 注入的 `PrismaService` 对象补充 `$disconnect` | 修复测试退出阶段的 Teardown 失败。 | Low | **NO** |
