# 内容链路闭环阶段 - 冻结声明

**生成时间**: 2025-12-14  
**阶段**: CONTENT_PIPELINE_PHASE  
**状态**: ✅ **已冻结**

---

## 一、冻结范围

### 1.1 冻结模块（禁止修改）

以下模块继续冻结，不得修改：

#### 1. Task / Job / Worker / Orchestrator

**冻结文件**:

- `apps/api/src/job/job.rules.ts`
- `apps/api/src/job/job.retry.ts`
- `apps/api/src/job/job.service.ts`
- `apps/api/src/job/job-worker.service.ts`
- `apps/api/src/orchestrator/orchestrator.service.ts`
- `apps/api/src/worker/worker.service.ts`
- `packages/config/src/env.ts`（仅 `workerHeartbeatTimeoutMs` 相关）

**冻结原因**:

- 已完成"0 雷区"加固
- 状态转换规则已明确
- 重试逻辑已统一
- 生产环境已验证稳定

#### 2. ApiSecurity / CE10

**冻结文件**:

- `apps/api/src/security/api-security/`（所有文件）
- `apps/api/src/auth/hmac/api-key.service.ts`（Secret 加密存储相关）

**冻结原因**:

- 已完成 Signature v2 规范
- Secret 已实现 AES-256-GCM 加密存储
- 生产环境已验证安全合规

#### 3. Prisma Core Schema

**冻结范围**:

- 禁止修改现有模型的核心字段
- 禁止修改现有枚举值
- 禁止删除现有字段

**允许操作**:

- ✅ 新增非破坏性字段（可选字段）
- ✅ 新增新模型
- ✅ 新增索引

**冻结原因**:

- 数据库契约已稳定
- 避免破坏现有数据

---

## 二、目标阶段

**阶段名称**: CONTENT_PIPELINE_PHASE

**阶段目标**:

- 内容链路闭环
- 质量评价体系
- 运营 & 计费闭环

**允许修改范围**:

- ✅ 内容质量逻辑
- ✅ Prompt / 策略
- ✅ 运营 & 计费闭环
- ✅ 内容生成流程优化

---

## 三、禁止事项

### 3.1 架构层面

- ❌ 新加 Engine 架构
- ❌ 重写 Task / Job
- ❌ 引入新状态机
- ❌ 再做"0 雷区"扫描

### 3.2 数据层面

- ❌ 修改 Prisma Core Schema 核心字段
- ❌ 修改现有枚举值
- ❌ 删除现有字段

---

## 四、冻结验证

**验证命令**:

```bash
git diff --name-only | grep -E "job\.rules|job\.retry|job\.service|job-worker|orchestrator\.service|worker\.service|api-security|secret-encryption"
```

**预期结果**: 不应出现上述文件（除非是文档或测试）

---

**冻结生效时间**: 2025-12-14  
**冻结状态**: ✅ **已生效**

---

## 五、冻结合规恢复声明

**恢复时间**: 2025-12-14  
**恢复原因**: CE 核心引擎商用化封装过程中，曾短暂在 `apps/api/src/job/job.service.ts` 中新增 `writeQualityMetrics` 方法，现已迁出到 `apps/api/src/quality/quality-metrics.writer.ts`，恢复冻结合规。

**恢复措施**:

1. ✅ 将 `writeQualityMetrics` 方法从 `apps/api/src/job/job.service.ts` 迁出
2. ✅ 新增 `apps/api/src/quality/quality-metrics.writer.ts` 独立服务
3. ✅ 新增 `apps/api/src/quality/quality.module.ts` 模块
4. ✅ 恢复 `apps/api/src/job/job.service.ts` 到改动前状态（不包含新增方法、不包含新增调用）
5. ✅ 在 `apps/api/src/text/text.service.ts` 中接入 `QualityMetricsWriter`（预留钩子，实际写入在 Worker 上报时处理）

**当前状态**: ✅ **冻结合规已恢复** - 冻结区文件未修改，所有新增功能通过封装层实现
