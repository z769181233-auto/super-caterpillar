# CE07 Assertion Boundary

| assertion target | current source of truth | should keep? | should remove/replace? | reason |
|---|---|---:|---:|---|
| `expect(String(result.status).toUpperCase()).toBe('SUCCESS')` | 业务流结果状态正常 | **YES** | **N/A** | 核心用例正常运行标志 |
| `expect(prisma.characterMemory.create).toHaveBeenCalled()` | 底层内存写入动作（`prisma` 未被 Mock 阻断该集合） | **YES** | **N/A** | 验证引擎确实调用了核心业务模型的保存 |
| `expect(prisma.sceneMemory.create).toHaveBeenCalled()` | 底层场景内存写入动作 | **YES** | **N/A** | 同上 |
| `expect(prisma.auditLog.create).toHaveBeenCalled()` | **auditService.log 被设为 jest.fn()，阻断了对底层 Prisma 的调用** | **NO** | 替换为: `expect(auditService.log).toHaveBeenCalled()` | 上层接口已走 Mock，底层代码不会被执行，断言应当收束在上层协作口径处。 |
| `expect(prisma.$transaction).toHaveBeenCalled()` | `prisma.$transaction` 依旧存在并包裹了 `memory` 写入 | **YES** | **N/A** | 测试代码提供了 transaction spy |
| `expect(mockBillingService.consumeCredits).toHaveBeenCalled()` | （此处已被 costLedgerService 隔离） | **NO** | 替换为: `expect(costLedgerService.recordFromEvent).toHaveBeenCalled()` | 与 `auditService` 同理，`costLedgerService` 如今也是独立的 jest.fn()，不应再断言它内部的细节。 |
