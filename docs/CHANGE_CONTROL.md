# 变更控制文档

## 目标

确保所有代码变更符合规范，防止破坏性改动，保证系统稳定性和可维护性。

## 白名单（允许修改的文件/模块）

### 业务逻辑模块（允许修改，但需遵循规范）

- `apps/api/src/job/` - Job 调度与状态管理
- `apps/api/src/worker/` - Worker 管理
- `apps/api/src/orchestrator/` - 调度器
- `apps/api/src/engine/` - 引擎适配器
- `apps/api/src/quality/` - 质量指标
- `apps/api/src/ops/` - 运维诊断接口

### 基础设施模块（谨慎修改）

- `apps/api/src/auth/` - 认证授权（需遵循 APISpec V1.1）
- `apps/api/src/security/` - 安全模块（需遵循 SafetySpec V1.1）
- `apps/api/src/audit-log/` - 审计日志（需遵循审计规范）

### 数据库（需迁移）

- `packages/database/prisma/schema.prisma` - 仅允许通过迁移修改
- 所有数据库变更必须：
  1. 创建迁移文件
  2. 运行 `pnpm -w --filter database prisma:migrate`
  3. 更新相关类型定义

### 测试文件（鼓励修改）

- `apps/api/test/` - 所有测试文件
- `tools/smoke/` - 烟雾测试
- `tools/ops/` - 运维脚本

### 文档（鼓励修改）

- `docs/` - 所有文档文件
- `README.md` - 项目说明

## 黑名单（禁止修改）

### 核心契约（禁止修改）

1. **APISpec V1.1 定义的错误码**
   - 4003: 签名错误（SIGNATURE_ERROR）
   - 4004: Nonce 重放（NONCE_REPLAY）
   - 禁止修改这些错误码的定义或语义

2. **Job 状态机规则**
   - `apps/api/src/job/job.rules.ts` - 状态转换规则
   - 禁止绕过 `transitionJobStatus` 直接修改状态
   - 禁止新增状态（除非有明确需求）

3. **审计日志格式**
   - `apps/api/src/audit/audit.constants.ts` - 审计动作常量
   - 禁止修改现有审计动作的语义
   - 禁止删除审计日志记录

### 数据库字段（禁止直接修改）

1. **核心表结构**
   - `shot_jobs.status` - Job 状态字段（必须通过状态机）
   - `audit_logs.action` - 审计动作（必须使用常量）
   - `job_engine_bindings.status` - 绑定状态（必须使用 enum）

2. **禁止操作**
   - ❌ 直接 `ALTER TABLE` 修改字段类型
   - ❌ 删除已使用的字段
   - ❌ 修改外键约束（除非有迁移计划）

### 安全相关（禁止修改）

1. **HMAC 验证逻辑**
   - `apps/api/src/auth/hmac/` - HMAC 签名验证
   - 禁止绕过签名验证
   - 禁止修改时间窗验证逻辑

2. **Nonce 防重放**
   - `apps/api/src/auth/nonce/` - Nonce 存储与验证
   - 禁止禁用 Nonce 检查
   - 禁止修改 Nonce TTL

## 变更流程

### 1. 计划阶段

每次改动前必须明确：

- **影响面**：哪些模块/接口/数据会受影响
- **回滚点**：如何回滚（git tag/commit）
- **验证方法**：如何验证改动正确性

### 2. 开发阶段

- 遵循白名单/黑名单规则
- 运行 `pnpm run preflight` 确保环境一致
- 运行 `pnpm run lint` 和 `pnpm run typecheck` 确保代码质量

### 3. 测试阶段

- 运行 `pnpm run test:contract` 确保契约不被破坏
- 运行 `pnpm run smoke` 确保运行时验证通过
- 更新相关文档

### 4. 提交阶段

- 提交信息必须包含：
  - 变更类型（feat/fix/chore）
  - 影响面
  - 回滚点（如需要）

## 回滚策略

### 需要回滚的变更类型

1. **鉴权/HMAC 相关**
   - 回滚点：git tag/commit
   - 数据回滚：通常不需要（逻辑变更）

2. **队列调度相关**
   - 回滚点：git tag/commit
   - 数据回滚：检查是否有脏数据需要修复

3. **Prisma schema/迁移**
   - 回滚点：git tag/commit
   - 数据回滚：运行回滚迁移 `prisma migrate resolve --rolled-back <migration_name>`

4. **Job 状态机**
   - 回滚点：git tag/commit
   - 数据回滚：检查是否有状态不一致的 Job，手动修复

### 不需要回滚的变更

- 纯脚本/CI/文档改动
- 测试文件修改
- 日志格式调整（不影响功能）

## 验证要求

### 每次变更必须验证

1. **Preflight Gate**
   ```bash
   pnpm run preflight
   ```

2. **Contract Gate**
   ```bash
   pnpm run test:contract
   ```

3. **Runtime Gate**
   ```bash
   pnpm run smoke
   ```

### 关键验证点

1. **HMAC/Nonce 契约**
   - 4003 错误码必须正确返回
   - 4004 错误码必须正确返回
   - 时间窗验证必须工作

2. **Job 状态机**
   - 合法状态转换必须允许
   - 非法状态转换必须拒绝
   - 状态机规则不可被破坏

3. **数据库一致性**
   - Prisma schema 与数据库必须一致
   - 所有迁移必须可回滚

## PR/任务模板

### 变更描述

- **类型**：feat/fix/chore
- **影响面**：列出受影响的模块/接口
- **回滚点**：git tag/commit（如需要）

### 验证输出

- Preflight: ✅/❌
- Contract: ✅/❌
- Smoke: ✅/❌

### 相关文档

- 更新的文档链接
- 相关规范文档引用

## 禁止事项（对齐开发执行顺序说明书）

1. ❌ 计划外文件修改（不在白名单内）
2. ❌ 直接修改 DB 字段（必须通过迁移）
3. ❌ 修改契约（APISpec/EngineSpec 定义的错误码、状态等）
4. ❌ 绕过状态机直接修改 Job 状态
5. ❌ 删除审计日志记录
6. ❌ 禁用安全验证（HMAC/Nonce）
7. ❌ 修改核心业务逻辑而不更新测试

## 例外情况

如有特殊情况需要修改黑名单内容，必须：

1. 获得明确授权
2. 更新相关规范文档
3. 提供完整的迁移/回滚计划
4. 更新所有相关测试

