# Stage5 · Prisma Client 单一来源治理 - 执行结果汇总

**执行时间**: 2025-12-13  
**模式**: EXECUTE → REPORT  
**状态**: ✅ DONE (Final)  
**是否允许回滚**: ❌ 不允许

---

## 一、背景与根因

在 Stage5 P0 安全重放问题排查过程中，确认根因之一为 **Prisma Client 多来源问题**：

- pnpm workspace 下存在 **多个 Prisma Client 实例**
- API 运行时加载的 Client 与生成的 Client 不一致
- 导致模型（如 `nonceStore`）在运行时不可见

**本 Stage 的目标**：

> **彻底消除 Prisma Client 多来源问题，建立全仓唯一、可验证、不可回滚的 Prisma Client 单一来源机制。**

---

## 二、执行动作总览（按顺序）

1. ✅ 全仓静态扫描 PrismaClient / `@prisma/client` 使用点
2. ✅ 检查 root package.json / turbo / workspace 依赖拓扑
3. ✅ 修复 PrismaService：**仅从 database 包导入 PrismaClient**
4. ✅ 移除 `apps/api` 对 `@prisma/client` 的直接依赖
5. ✅ 将 `database` 设为 workspace 唯一 Prisma Client 提供方
6. ✅ 固化 Prisma Client 生成链路（postinstall）
7. ✅ 修复 database 包 export，保证可被 API 正确 import
8. ✅ 统一迁移 apps/api 内所有 Prisma 类型导入
9. ✅ 排除 scripts 目录，避免影响生产构建
10. ✅ 构建验证（api）
11. ✅ 行为验证（Nonce / 重放）
12. ✅ E2E 验证（4/4）

---

## 三、修改文件清单（必须保留在提交记录）

### 核心配置与基础设施（5 个）

1. **`apps/api/src/prisma/prisma.service.ts`**
   - PrismaClient 导入改为从 `database` 包
   - 添加 dev/test 环境诊断日志

2. **`apps/api/package.json`**
   - 移除 `@prisma/client: "5.22.0"`
   - 新增 `database: "workspace:*"`

3. **`apps/api/tsconfig.json`**
   - paths 增加 `"database": ["../../packages/database/src"]`
   - exclude 增加 `"src/scripts/**/*"`

4. **`apps/api/src/auth/nonce.service.ts`**
   - 添加 `$queryRaw` fallback 的 TODO 注释
   - 添加 fallback 使用时的警告日志

5. **`package.json`**（repo root）
   - scripts 增加 `"postinstall": "pnpm --filter database prisma:generate"`

### 类型导入迁移（14 个业务文件）

6. `apps/api/src/worker/worker.service.ts`
7. `apps/api/src/orchestrator/orchestrator.service.ts`
8. `apps/api/src/job/job.service.ts`
9. `apps/api/src/task/task.service.ts`
10. `apps/api/src/project/project.service.ts`
11. `apps/api/src/project/project.controller.ts`
12. `apps/api/src/project/project-structure.service.ts`
13. `apps/api/src/novel-import/novel-import.controller.ts`
14. `apps/api/src/task/engine-task.service.ts`
15. `apps/api/src/auth/dto/register.dto.ts`
16. `apps/api/src/organization/organization.service.ts`
17. `apps/api/src/worker/dto/heartbeat.dto.ts`
18. `apps/api/src/job/dto/report-job.dto.ts`
19. `apps/api/src/job/job-worker.service.ts`

**修改内容**：所有 `from '@prisma/client'` 改为 `from 'database'`

> **说明**：`database` 包已 re-export Prisma 类型

---

## 四、关键技术变更（不可回滚点）

### 1️⃣ PrismaClient 唯一来源

```typescript
// ❌ 禁止
import { PrismaClient } from '@prisma/client';

// ✅ 唯一允许
import { PrismaClient } from 'database';
```

**规则**：

- PrismaClient 只能存在于 `packages/database`
- 所有运行时代码必须通过 workspace 依赖获取

### 2️⃣ apps/api 依赖约束

```json
// apps/api/package.json
{
  "dependencies": {
    "database": "workspace:*"
  }
}
```

**禁止项**：

- ❌ apps/api 禁止再引入 `@prisma/client`
- ❌ 禁止通过 devDependencies / indirect 方式引入

### 3️⃣ Prisma Client 生成链路固化

```json
// repo root package.json
{
  "scripts": {
    "postinstall": "pnpm --filter database prisma:generate"
  }
}
```

**效果**：

- 每次 `pnpm install` 后自动生成 Prisma Client
- 避免"本地有 / CI 没有 / 运行时不一致"问题

### 4️⃣ TypeScript 路径与构建隔离

```json
// apps/api/tsconfig.json
{
  "paths": {
    "database": ["../../packages/database/src"]
  },
  "exclude": ["src/scripts/**/*"]
}
```

**规则**：

- scripts 目录允许使用 `@prisma/client`（独立工具脚本）
- 生产代码不允许

---

## 五、关于 $queryRaw fallback 的正式结论

### 当前结论：保留（NO DELETE）

**原因**：
虽然单一来源治理已完成，但需要运行时稳定性观测周期。

### 删除 $queryRaw 的唯一条件（必须全部满足）

1. ✅ PrismaService 启动日志持续显示：

   ```
   hasNonceStore: true
   ```

2. ✅ 连续多次 dev / test / E2E 运行未触发 fallback 警告

3. ✅ 冷安装（删除 node_modules 后 `pnpm install`）仍稳定

**在此之前，任何删除 fallback 的行为均视为违规修改。**

---

## 六、验证结果（硬性验收）

### 1. 构建验证

```bash
pnpm --filter api build
```

**结果**: ✅ 通过

```
webpack 5.97.1 compiled successfully in 17268 ms
```

### 2. 行为验收（Stage5 P0 硬条件）

| 条目             | 结果                                |
| ---------------- | ----------------------------------- |
| 第一次合法请求   | ≠ 4003 / 4004 ✅                    |
| nonce_store 写入 | COUNT > 0 ✅                        |
| 第二次同 nonce   | 4004 ✅                             |
| 审计日志         | 仅重放写入 NONCE_REPLAY_DETECTED ✅ |

### 3. E2E 最终验收

```bash
pnpm exec ts-node apps/api/test/hmac-security.e2e-spec.ts
```

**结果**:

```
测试 1: 白名单免签接口 (/api/health)
✅ 通过

测试 2: 必签接口缺少签名头应返回 4003
✅ 通过

测试 3: 合法签名请求应成功（非签名错误）
✅ 通过

测试 4: Nonce 重放应返回 4004
✅ 通过

=== 测试结果汇总 ===
通过: 4/4
✅ 白名单免签接口返回 200
✅ 必签接口缺少签名头返回 4003
✅ 合法签名请求成功（非签名错误）
✅ Nonce 重放返回 4004
```

**结果**: ✅ 全通过（4/4）

---

## 七、永久性架构约束（写入铁律）

以下规则**永久生效**，任何违反均视为架构回退：

1. ❌ **apps/api 不得引入 @prisma/client**
   - 禁止在 `apps/api/package.json` 中添加 `@prisma/client`
   - 禁止通过 devDependencies / indirect 方式引入

2. ❌ **apps/api 不得直接 import @prisma/client**
   - 禁止 `import { PrismaClient } from '@prisma/client'`
   - 禁止 `import { TaskType } from '@prisma/client'`
   - 禁止任何形式的 `from '@prisma/client'` 导入

3. ✅ **PrismaClient 唯一来源：packages/database**
   - 所有 PrismaClient 实例必须从 `database` 包导入
   - 所有 Prisma 类型必须从 `database` 包导入（database 已 re-export）

4. ✅ **Prisma 类型统一从 database 导出**
   - 所有业务代码必须使用 `from 'database'` 导入类型

5. ✅ **scripts 目录例外（不参与构建）**
   - `apps/api/src/scripts/**` 目录已排除在构建之外
   - 脚本文件可继续使用 `@prisma/client`（独立工具脚本，不影响生产代码）

---

## 八、架构收益总结

1. ✅ **消除 Prisma Client 多实例风险**
   - 全仓唯一来源，避免版本不一致
   - 运行时模型可预测、可验证

2. ✅ **依赖关系清晰**
   - apps/api 不再直接依赖 `@prisma/client`
   - 通过 workspace 依赖 `database` 包，依赖关系明确
   - 便于后续版本升级和维护

3. ✅ **生成流程自动化**
   - `postinstall` 脚本确保每次安装后自动生成
   - 避免因忘记生成导致的运行时错误
   - pnpm / CI / 本地行为一致

4. ✅ **类型安全**
   - TypeScript 路径映射确保编译时类型正确
   - 运行时通过 workspace 依赖解析到正确的 Client
   - 类型导入统一，减少不一致风险

5. ✅ **Stage5 P0 安全链路彻底闭环**
   - nonceStore 模型在运行时稳定可用
   - 安全重放检测机制正常工作
   - E2E 测试全量通过

---

## 九、最终结论

### Stage5 · Prisma Client 单一来源治理

**状态**: ✅ **DONE (Final)**

**验收结论**:

- ✅ 技术目标完成
- ✅ 架构约束固化
- ✅ 行为与 E2E 全量验证通过
- ✅ 不存在待办阻断项

**报告生成时间**: 2025-12-13  
**报告状态**: 最终版（Final）  
**是否允许回滚**: ❌ **不允许**

---

## 十、后续建议

1. **监控 PrismaService 启动日志**
   - 持续观察 `hasNonceStore: true` 是否稳定
   - 确认未触发 `$queryRaw` fallback 警告

2. **删除 $queryRaw fallback**
   - 在满足删除条件后，删除 fallback 代码
   - 仅保留 `prisma.nonceStore.create` 路径

3. **文档更新**
   - 更新开发文档，明确 Prisma Client 使用规范
   - 禁止新代码直接使用 `@prisma/client`

4. **CI/CD 检查**
   - 添加 lint 规则，禁止 `@prisma/client` 导入
   - 确保新代码遵循单一来源原则

---

**报告结束**
