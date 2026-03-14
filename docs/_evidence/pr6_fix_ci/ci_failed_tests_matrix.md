# CI Failed Tests Matrix

| test file | suite name | first real error | type(env/mock/assert/db/other) | exact fix target |
|---|---|---|---|---|
| `engine-profile.service.spec.ts` | `EngineProfileService` | `JWT_REFRESH_SECRET is required but missing` | env | Inject dummy `.env` vars directly in `ci.yml` `env` config |
| `task-graph.controller.spec.ts` | `TaskGraphController` | `SHOT_RENDER_PROVIDER env: undefined` | env | Inject mock `.env` vars directly in `ci.yml` `env` config |
| `ce07_memory_update.spec.ts` | `CE07MemoryUpdateAdapter` | `this.auditService.log is not a function` | mock | Replace concrete instantiation `new AuditService(prisma)` with `{ log: jest.fn() }` |
| `shot_preview.spec.ts` | `ShotPreviewFastAdapter` | `this.costLedgerService.recordFromEvent is not a function` | mock | Ensure `recordFromEvent` and `log` exist in mock structs |
| `api-security.spec.ts` & others | Teardown Hooks | `Cannot read properties of undefined (reading '$disconnect')` | mock | Add `$disconnect` mock to isolated `providers: [PrismaService]` arrays |
