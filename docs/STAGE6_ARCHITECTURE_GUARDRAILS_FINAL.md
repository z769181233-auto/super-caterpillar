# Stage6 · 架构约束自动化与回归防线（Guardrails Stage）

**执行时间**: 2025-12-13  
**模式**: EXECUTE → REPORT  
**状态**: ✅ DONE (Final)  
**是否允许回滚**: ❌ 不允许

---

## 一、背景与目标

### 背景

Stage5 已建立 Prisma Client 单一来源机制，并固化了永久性架构约束。为确保这些约束在后续开发中不被违反，需要建立自动化检查机制。

### 目标

1. **ESLint 规则**：在编译时禁止 `apps/api` 中导入 `@prisma/client`
2. **CI 脚本检查**：在 CI 流程中自动验证 Prisma 单一来源约束
3. **Fallback 保护**：防止 `nonce.service.ts` 中的 `$queryRaw` fallback 被误删
4. **自动化防线**：任何违反约束的提交在 CI 中直接失败

---

## 二、不可变事实（Stage5 继承）

以下事实来自 Stage5 Final 报告（`docs/STAGE5_PRISMA_CLIENT_SINGLE_SOURCE_GOVERNANCE_REPORT.md`），作为 Stage6 的基础：

1. ❌ `apps/api` 禁止引入 `@prisma/client`
2. ❌ `apps/api` 禁止直接 `import '@prisma/client'`
3. ✅ PrismaClient 唯一来源：`packages/database`
4. ✅ Prisma 类型统一从 `database` 包导出
5. ✅ `$queryRaw` fallback 按 Stage5 约束保留（未满足删除条件前禁止删除）

> **Stage5 报告路径**: `docs/STAGE5_PRISMA_CLIENT_SINGLE_SOURCE_GOVERNANCE_REPORT.md`

---

## 三、Stage6 Guardrails（ESLint / CI Scripts / Workflow Hooks）

### 3.1 ESLint 规则

**文件**: `apps/api/.eslintrc.json`

**规则**:
```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@prisma/client",
            "message": "❌ 禁止在 apps/api 中直接使用 @prisma/client。PrismaClient/Prisma 类型必须从 database 包导入。"
          }
        ]
      }
    ]
  }
}
```

**效果**:
- 在 `apps/api` 中任何 `import '@prisma/client'` 都会触发 ESLint 错误
- `pnpm -w lint` 会直接失败
- IDE 中会显示错误提示

### 3.2 CI 脚本：Prisma 单一来源检查

**文件**: `tools/ci/check-prisma-single-source.sh`

**功能**:
- 扫描 `apps/api` 目录，禁止任何 `@prisma/client` 引用
- 排除 `node_modules`、`dist`、`.next` 目录
- 发现违规直接退出码 1

**执行**:
```bash
bash tools/ci/check-prisma-single-source.sh
```

### 3.3 CI 脚本：Nonce Fallback 保护

**文件**: `tools/ci/check-nonce-fallback.sh`

**功能**:
- 检查 `apps/api/src/auth/nonce.service.ts` 文件存在
- 验证必须包含三个关键标记：
  1. `TODO(Stage5-P0): $queryRaw fallback`
  2. `$queryRaw` 使用
  3. `NonceService.*fallback` 相关日志/文案

**执行**:
```bash
bash tools/ci/check-nonce-fallback.sh
```

### 3.4 CI Workflow 集成

**文件**: `.github/workflows/ci.yml`

**新增步骤**（在 `pnpm install` 之后，`lint` 之前）:
```yaml
- name: Stage6 guard - Prisma single source
  run: bash tools/ci/check-prisma-single-source.sh

- name: Stage6 guard - Nonce fallback protected
  run: bash tools/ci/check-nonce-fallback.sh
```

**执行顺序**:
1. Checkout
2. Setup pnpm / Node.js
3. Install dependencies
4. **Stage6 guard - Prisma single source** ← 新增
5. **Stage6 guard - Nonce fallback protected** ← 新增
6. Lint
7. Build

---

## 四、违规示例（会被拦截的 3 个例子）

### 示例 1：直接 import @prisma/client

**违规代码**:
```typescript
// apps/api/src/some-service.ts
import { PrismaClient } from '@prisma/client'; // ❌ 会被拦截
```

**拦截方式**:
- ESLint 错误：`❌ 禁止在 apps/api 中直接使用 @prisma/client...`
- CI 脚本失败：`❌ Forbidden reference detected: @prisma/client under apps/api`

### 示例 2：在 apps/api package.json 中添加依赖

**违规操作**:
```json
// apps/api/package.json
{
  "dependencies": {
    "@prisma/client": "5.22.0" // ❌ 会被拦截
  }
}
```

**拦截方式**:
- CI 脚本失败：`❌ Forbidden reference detected: @prisma/client under apps/api`
- 即使代码中没有 import，package.json 中的依赖也会被检测到

### 示例 3：删除 nonce fallback 标记

**违规操作**:
```typescript
// apps/api/src/auth/nonce.service.ts
// 删除了 TODO(Stage5-P0): $queryRaw fallback 标记 // ❌ 会被拦截
```

**拦截方式**:
- CI 脚本失败：`❌ Missing required marker: TODO(Stage5-P0): \$queryRaw fallback`
- 或：`❌ Missing required usage: \$queryRaw`
- 或：`❌ Missing required log/wording about fallback`

---

## 五、执行与验收清单

### 5.1 执行命令

#### ESLint 验证
```bash
pnpm -w lint
```
**通过标准**: 无错误输出，退出码 0

#### 构建验证
```bash
pnpm --filter api build
```
**通过标准**: 编译成功，无错误

#### Prisma 单一来源检查
```bash
bash tools/ci/check-prisma-single-source.sh
```
**通过标准**: 输出 `✅ [Stage6] Prisma single-source constraint OK`，退出码 0

#### Nonce Fallback 保护检查
```bash
bash tools/ci/check-nonce-fallback.sh
```
**通过标准**: 输出 `✅ [Stage6] NonceService fallback guard OK`，退出码 0

### 5.2 验收清单

- [x] ESLint 规则已配置并生效
- [x] CI 脚本 `check-prisma-single-source.sh` 已创建且可执行
- [x] CI 脚本 `check-nonce-fallback.sh` 已创建且可执行
- [x] CI Workflow 已集成两个检查步骤
- [x] 所有验证命令通过
- [x] Stage6 Final 文档已生成

---

## 六、新增护栏文件路径

### ESLint 配置
- `apps/api/.eslintrc.json`（修改）

### CI 脚本
- `tools/ci/check-prisma-single-source.sh`（新增）
- `tools/ci/check-nonce-fallback.sh`（新增）

### CI Workflow
- `.github/workflows/ci.yml`（新增）

### 文档
- `docs/STAGE6_ARCHITECTURE_GUARDRAILS_FINAL.md`（新增）

---

## 七、最终结论

### Stage6 · 架构约束自动化与回归防线

**状态**: ✅ **DONE (Final)**

**验收结论**:
- ✅ ESLint 规则已配置并生效
- ✅ CI 脚本已创建且可执行
- ✅ CI Workflow 已集成检查步骤
- ✅ 所有验证命令通过
- ✅ 文档已生成

**约束执行**:
- 任何违反约束的提交**直接拒绝**（无需讨论）
- ESLint 错误 → 提交失败
- CI 脚本失败 → 提交失败

**报告生成时间**: 2025-12-13  
**报告状态**: 最终版（Final）  
**是否允许回滚**: ❌ **不允许**

---

## 八、后续维护

1. **保持脚本可执行**
   - 确保 `tools/ci/*.sh` 文件权限为可执行
   - CI 环境必须支持 bash

2. **监控 CI 失败**
   - 任何 Stage6 guard 失败必须修复
   - 不允许通过修改脚本绕过检查

3. **更新约束**
   - 如需新增约束，更新对应脚本和文档
   - 保持与 Stage5 报告的一致性

---

**报告结束**

