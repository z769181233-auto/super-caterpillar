# STAGE3 总览文档｜正式版（中文）

**文档版本**: v2.0  
**最后更新**: 2025-12-11  
**状态**: ✅ Stage3 已完成（核心能力 100%），S3-C Phase 2/3 标记为可选增强（P1/P2）

---

## 目录

1. [Stage3 的最终目标与核心价值](#1-stage3-的最终目标与核心价值)
2. [全局架构图](#2-全局架构图)
3. [S3-A 最终成果（含封板边界）](#3-s3-a-最终成果含封板边界)
4. [S3-B 最终成果（Config Store / Version System / RoutingLayer）](#4-s3-b-最终成果config-store--version-system--routinglayer)
5. [S3-C 最终成果（统一引擎信息模型 + Studio/TaskGraph/导入页联动）](#5-s3-c-最终成果统一引擎信息模型--studiotaskgraph导入页联动)
6. [质量/性能指标体系](#6-质量性能指标体系)
7. [统一 UI 组件体系](#7-统一-ui-组件体系)
8. [所有禁止修改的边界](#8-所有禁止修改的边界)
9. [Stage3 交付物列表](#9-stage3-交付物列表)
10. [如何从 Stage3 平滑进入 Stage4](#10-如何从-stage3-平滑进入-stage4)

---

## 1. Stage3 的最终目标与核心价值

### 目标

在 Stage2 稳定基座之上，为系统引入**多引擎支持能力**和**统一引擎信息架构**。从单一本地引擎扩展到支持 HTTP 引擎、多版本引擎，建立从配置层到执行层再到展示层的完整引擎信息链路，为 Stage4（引擎差异化执行）和 Stage5（自动化性能对比）提供必要的基础设施。

### 内容

**三大核心板块**：

| 板块 | 目标 | 核心成果 | 状态 |
|------|------|---------|------|
| **S3-A** | HTTP 引擎真实接入 | HTTP 配置读取、认证机制、错误分类、调用链路 | ✅ 100% 完成（封板） |
| **S3-B** | 引擎配置与版本管理 | ConfigStore（DB+JSON 合并）、Version System、RoutingLayer | ✅ 100% 完成 |
| **S3-C** | Studio/导入页联动 | 统一信息模型、Shared Types、URL 联动、统一 UI 组件 | ✅ 100% 完成（Phase 1） |

**核心价值**：

1. **多引擎支持**：系统从单一本地引擎扩展到支持 HTTP 引擎、多版本引擎，为未来接入更多 LLM 服务奠定基础
2. **统一信息架构**：建立从配置层到执行层再到展示层的完整引擎信息链路，确保数据一致性和可追溯性
3. **质量可视化**：将引擎执行的质量指标、性能指标、成本指标统一展示，为决策提供数据支撑
4. **为未来铺路**：为 Stage4（引擎差异化执行）、Stage5（自动化性能对比）提供必要的基础设施

### 关键结果

- ✅ S3-A、S3-B、S3-C Phase 1 全部完成，Stage3 核心功能 100% 完成
- ✅ S3-C Phase 2（监控页引擎维度增强）和 Phase 3（高级可视化）标记为可选增强项（P1/P2），不影响 Stage3 完成度
- ✅ 所有核心模块已封板，禁止修改
- ✅ 统一引擎信息链路已打通，前后端数据一致性得到保障

---

## 2. 全局架构图

### 目标

清晰展示从配置层到执行层再到展示层的完整引擎信息链路，说明各层之间的数据流向和依赖关系。

### 内容

#### 2.1 后端引擎链路（配置 → 路由 → 适配器 → 执行）

```
┌─────────────────────────────────────────────────────────────┐
│                    配置层（S3-B）                             │
├─────────────────────────────────────────────────────────────┤
│  JSON Config → DB Config → Environment Variables           │
│         ↓              ↓              ↓                     │
│    EngineConfigStoreService (合并优先级: DB > JSON)         │
│         ↓                                                   │
│    Version System (版本合并: EngineVersion > Engine > JSON) │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    路由决策层（S3-B.3）                       │
├─────────────────────────────────────────────────────────────┤
│  EngineRoutingService.routeEngine()                         │
│  规则: payload.engineKey > NOVEL_ANALYSIS默认 >             │
│        *_HTTP JobType > useHttpEngine > baseEngineKey       │
│         ↓                                                   │
│  EngineRegistry.invoke()                                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    适配器层（S3-A）                           │
├─────────────────────────────────────────────────────────────┤
│  LocalAdapter / HttpEngineAdapter                          │
│  (认证、错误分类、重试策略)                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    执行层（Worker）                            │
├─────────────────────────────────────────────────────────────┤
│  Worker 拉取 Job → adapter.invoke() → 更新 Job 状态        │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Studio 数据流（API → Shared Types → UI 组件 → 页面）

```
后端 API 层
  ├─ JobService.extractEngineKeyFromJob() (统一抽取)
  ├─ TaskGraphController.enrichJobsWithEngineInfo()
  └─ QualityScoreService.buildQualityScoreFromJob()
         ↓
Shared Types 层
  ├─ JobWithEngineInfo
  ├─ TaskGraphWithEngineInfo
  └─ EngineSummary
         ↓
前端 API 客户端层
  ├─ jobApi.listJobs()
  ├─ getTaskGraph()
  └─ getEngineSummary()
         ↓
统一 UI 组件层
  ├─ EngineTag
  ├─ AdapterBadge
  ├─ QualityScoreBadge
  ├─ EngineFilter
  └─ EngineSummaryPanel
         ↓
页面层
  ├─ /studio/jobs
  ├─ /projects/[projectId]/import-novel
  └─ /tasks/[taskId]/graph
         ↓
URL 参数驱动 (?engineKey=xxx) → 全局联动刷新
```

### 关键结果

- ✅ 建立了从配置到执行的完整后端链路
- ✅ 建立了从 API 到页面的完整前端数据流
- ✅ 所有层级之间通过统一类型和统一组件连接，确保数据一致性

---

## 3. S3-A 最终成果（含封板边界）

### 目标

实现真实 HTTP LLM 服务的接入能力，支持多种认证方式、错误分类和重试策略，确保 HTTP 引擎调用的安全性和可靠性。

### 内容

**核心能力**：

1. **HTTP 引擎配置读取**
   - 支持环境变量配置（`HTTP_ENGINE_BASE_URL`、`HTTP_ENGINE_API_KEY` 等）
   - 支持 JSON 配置文件（`engines.json`）
   - 配置优先级：环境变量 > JSON 配置

2. **多种认证方式**
   - Bearer Token：`Authorization: Bearer ${API_KEY}`
   - API Key Header：`X-API-Key: ${API_KEY}`
   - HMAC 签名：支持请求体签名验证

3. **错误分类与重试策略**
   - 网络错误（ECONNRESET, ETIMEDOUT）→ `RETRYABLE`
   - HTTP 4xx 错误 → `FAILED`（不重试）
   - HTTP 5xx 错误 → `RETRYABLE`（可重试）
   - 业务层错误（response.success=false）→ `FAILED`

4. **日志脱敏机制**
   - API Key 等敏感信息在日志中自动脱敏
   - 支持配置日志级别和脱敏规则

**HTTP 引擎接入规则**：

- **方式 1**：新增实验性 JobType（`*_HTTP` 后缀）
- **方式 2**：显式 Feature Flag（`useHttpEngine: true`）
- **关键约束**：`NOVEL_ANALYSIS` 默认引擎必须保持 `default_novel_analysis`，禁止通过 HTTP 替换

### 关键结果

- ✅ HTTP 引擎调用链路完整实现
- ✅ 支持多种认证方式和错误处理策略
- ✅ 日志脱敏机制保障安全性
- ✅ 封板文件：`apps/api/src/config/engine.config.ts`、`apps/api/src/engine/adapters/http-engine.adapter.ts`

---

## 4. S3-B 最终成果（Config Store / Version System / RoutingLayer）

### 目标

建立统一的引擎配置管理体系，支持多引擎、多版本的配置管理，实现智能路由决策，确保引擎选择的正确性和可追溯性。

### 内容

#### 4.1 Config Store（DB + JSON 合并机制）

**配置来源与优先级**：

| 配置来源 | 优先级 | 说明 |
|---------|--------|------|
| EngineVersion.DB | 最高 | 版本级配置（通过 EngineVersion 表） |
| Engine.DB | 中 | Engine 级配置（通过 Engine 表） |
| JSON (engines.json) | 次 | 默认配置，适用于开发/测试环境 |
| 环境变量 | 特殊 | 覆盖敏感信息（如 API Key） |

**合并逻辑**：
```typescript
// 1. 从 JSON 读取基础配置
// 2. 从 DB 读取配置（如果存在），覆盖 JSON 配置
// 3. 环境变量覆盖（在配置读取时处理）
// 优先级：DB > JSON > Environment Variables
```

**特殊处理**：`default_novel_analysis` 保持 JSON 不变，不受 DB 配置影响（向后兼容）。

#### 4.2 Version System（版本系统）

**版本解析流程**：
```
1. 如果显式指定 requestedVersion，查找并合并 EngineVersion 配置
2. 否则使用 Engine.defaultVersion（如果存在）
3. 降级：使用 Engine 基础配置
```

**版本合并优先级**：`EngineVersion.config(DB) > Engine.config(DB) > JSON Config`

**安全约束**：前端不允许动态修改已有 Job 的 engineVersion。版本在 Job 创建时固化，执行过程中切换可能导致结果不一致。

#### 4.3 RoutingLayer（路由决策层）

**路由规则**（`EngineRoutingService.routeEngine(jobType, payload)`）：

| 优先级 | 条件 | 返回 engineKey |
|--------|------|---------------|
| 1 | `payload.engineKey` 显式指定 | 直接使用 |
| 2 | `jobType === 'NOVEL_ANALYSIS'` | `default_novel_analysis`（安全约束） |
| 3 | `jobType.endsWith('_HTTP')` | HTTP 引擎（如 `http_gemini_v1`） |
| 4 | `payload.useHttpEngine === true` | HTTP 引擎 |
| 5 | 其他 | `baseEngineKey`（降级） |

**为什么 NOVEL_ANALYSIS 必须保持稳定**：现有分析链路依赖本地适配器，修改可能导致系统不稳定。HTTP 引擎通过新增 JobType 或 Feature Flag 接入，不影响现有链路。

### 关键结果

- ✅ 建立了完整的配置管理体系（Config Store + Version System）
- ✅ 实现了智能路由决策层（RoutingLayer）
- ✅ 支持多引擎、多版本的配置管理
- ✅ 路由规则清晰，优先级明确，确保引擎选择的正确性

---

## 5. S3-C 最终成果（统一引擎信息模型 + Studio/TaskGraph/导入页联动）

### 目标

建立统一的前端引擎信息展示体系，实现全局联动机制，确保所有页面对引擎信息的展示保持一致，数据流清晰可追溯。

### 内容

#### 5.1 统一引擎信息模型

**核心字段定义**：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `engineKey` | `string` | `payload.engineKey` 或默认引擎 | 引擎标识，必填 |
| `engineVersion` | `string \| null` | `payload.engineVersion` 或 `engineConfig.versionName` | 引擎版本，可选 |
| `adapterName` | `string` | `adapter.name` 或 `engineKey` | 适配器名称，必填 |
| `qualityScore.score` | `number \| null` | `payload.result.quality.score` | 质量评分（0-1） |
| `qualityScore.confidence` | `number \| null` | `payload.result.quality.confidence` | 置信度（0-1） |
| `metrics.durationMs` | `number \| null` | `payload.result.metrics.durationMs` | 耗时（毫秒） |
| `metrics.costUsd` | `number \| null` | `payload.result.metrics.costUsd` | 成本（美元） |
| `metrics.tokens` | `number \| null` | `payload.result.metrics.tokens` | Token 数 |

**统一抽取逻辑**：

- 实现位置：`JobService.extractEngineKeyFromJob()` / `extractEngineVersionFromJob()`
- 使用位置：所有需要引擎信息的服务都使用统一方法
- 统一性保证：所有服务都使用 `JobService` 的统一方法，确保提取逻辑一致

**Shared Types 统一类型规范**：

| 类型 | 定义位置 | 使用场景 |
|------|---------|---------|
| `JobWithEngineInfo` | `packages/shared-types/src/jobs/job-with-engine-info.dto.ts` | `GET /api/jobs` 返回结构 |
| `TaskGraphWithEngineInfo` | `packages/shared-types/src/tasks/task-graph-with-engine-info.dto.ts` | `GET /api/tasks/:taskId/graph` 返回结构 |

#### 5.2 Studio/TaskGraph/导入页联动

**URL 参数驱动的全局联动机制**：

- 核心原则：URL 参数（`?engineKey=xxx`）是唯一的"全局状态源"
- 实现机制：`EngineFilter` 组件从 URL 读取参数，用户选择时更新 URL，`useEffect` 监听变化自动刷新数据
- 优势：状态持久化、全局同步、可分享

**三大关键页面联动**：

| 页面 | 统一组件 | 主要 API | URL 参数 |
|------|---------|---------|---------|
| `/studio/jobs` | EngineTag、AdapterBadge、QualityScoreBadge、EngineFilter、EngineSummaryPanel | `GET /api/jobs?engineKey=xxx`<br>`GET /api/jobs/engine-summary?engineKey=xxx` | `?engineKey=xxx` |
| `/projects/[projectId]/import-novel` | EngineTag、AdapterBadge、QualityScoreBadge、EngineSummaryPanel | `GET /api/jobs/engine-summary?engineKey=xxx&projectId=xxx`<br>`GET /api/jobs?projectId=xxx&type=NOVEL_ANALYSIS*` | - |
| `/tasks/[taskId]/graph` | EngineTag、AdapterBadge、QualityScoreBadge、EngineFilter | `GET /api/tasks/:taskId/graph` | `?engineKey=xxx` |

**关键特性**：
- 所有页面使用统一组件展示引擎信息
- 所有页面只读，不触发执行/调度行为
- URL 参数变化时，页面自动联动刷新

### 关键结果

- ✅ 建立了统一的引擎信息模型（JobWithEngineInfo / TaskGraphWithEngineInfo）
- ✅ 实现了统一的信息抽取逻辑（JobService 统一方法）
- ✅ 实现了 URL 参数驱动的全局联动机制
- ✅ 三大关键页面全部使用统一组件，展示一致

---

## 6. 质量/性能指标体系

### 目标

建立统一的质量指标和性能指标体系，确保所有页面展示格式一致，为决策提供数据支撑，为 Stage4/Stage5 的智能选型和 A/B 测试提供基础。

### 内容

#### 6.1 质量指标

**质量评分（score）**：
- 范围：0-1
- 格式：保留 2 位小数（`0.85`）
- 颜色编码：
  - `>= 0.8` → 绿色（高质量）
  - `0.6 - 0.8` → 橙/黄（中等质量）
  - `< 0.6` → 红色（低质量）
  - `null` → 灰色（无数据，显示 "-"）

**置信度（confidence）**：
- 范围：0-1
- 格式：保留 2 位小数（`0.90`）
- 显示：可选显示，小号灰字

#### 6.2 性能指标

**耗时（durationMs）**：
- 单位：毫秒
- 格式：秒，保留 1 位小数（`2.5s`）
- 显示：`2.5s` 或 `-`（无数据）

**成本（costUsd）**：
- 单位：美元
- 格式：美元，保留 4 位小数（`$0.0010`）
- 显示：`$0.0010` 或 `-`（无数据）

**Token 数（tokens）**：
- 单位：数量
- 格式：整数或带千分位（`1,000`）
- 显示：`1,000` 或 `-`（无数据）

#### 6.3 指标用途

- **质量指标**（score/confidence）：用于比较不同引擎输出好坏，为 Stage4/Stage5 的"模型竞速与 A/B 测试"提供基础
- **性能指标**（durationMs/tokens/costUsd）：用于比较成本与速度，为调度优化和成本控制提供数据支撑

### 关键结果

- ✅ 建立了统一的质量/性能指标体系
- ✅ 所有指标格式规范统一（颜色、数值格式）
- ✅ 所有指标必须通过统一组件展示，禁止手写样式
- ✅ 为 Stage4/Stage5 的智能选型和 A/B 测试提供了数据基础

---

## 7. 统一 UI 组件体系

### 目标

建立统一的前端 UI 组件体系，确保所有页面对引擎信息、质量指标、适配器信息的展示格式一致，提升用户体验和维护效率。

### 内容

#### 7.1 核心组件

**EngineTag**（引擎标签组件）：
- 功能：统一展示 engineKey 和 engineVersion
- 格式：`engineKey` 主体 + `@version` 小号灰字（version 为空时只显示 key）
- 位置：`apps/web/src/components/engines/EngineTag.tsx`
- Props：`engineKey`（必填）、`engineVersion`（可选）、`size`、`className`

**AdapterBadge**（适配器标签组件）：
- 功能：统一展示适配器类型（HTTP/Local）
- 格式：HTTP 适配器显示紫色标签，Local 适配器显示灰色标签
- 位置：`apps/web/src/components/engines/AdapterBadge.tsx`
- Props：`adapterName`（必填）、`size`、`className`

**QualityScoreBadge**（质量指标组件）：
- 功能：统一展示质量评分，支持颜色编码
- 格式：根据 score 值自动选择颜色（绿色/橙黄/红色），可选显示置信度
- 位置：`apps/web/src/components/quality/QualityScoreBadge.tsx`
- Props：`score`（必填）、`confidence`（可选）、`showConfidence`、`size`、`variant`

**EngineFilter**（引擎筛选器）：
- 功能：统一的引擎筛选组件，基于 URL 参数驱动
- 格式：下拉选择器，选择后更新 URL 参数
- 位置：`apps/web/src/components/engines/EngineFilter.tsx`
- Props：`queryParam`（默认 `engineKey`）、`onChange`

**EngineSummaryPanel**（质量摘要面板）：
- 功能：展示引擎的质量摘要统计
- 格式：卡片式布局，显示总任务数、平均评分、成功率、平均耗时、平均成本
- 位置：`apps/web/src/components/engines/EngineSummaryPanel.tsx`
- Props：`engineKey`、`projectId`（可选）

#### 7.2 使用规范

**必须使用统一组件**：
- ✅ 所有质量指标必须使用 `QualityScoreBadge` 组件
- ✅ 所有引擎信息必须使用 `EngineTag` 组件
- ✅ 所有适配器信息必须使用 `AdapterBadge` 组件
- ✅ 所有引擎筛选必须使用 `EngineFilter` 组件

**禁止行为**：
- ❌ 禁止在页面中手写颜色代码（如 `#4CAF50`）
- ❌ 禁止在页面中手写格式逻辑（如 `score.toFixed(2)`）
- ❌ 禁止在页面中手写引擎标签（如 `<span>{engineKey}@{version}</span>`）

### 关键结果

- ✅ 建立了 5 个统一 UI 组件（EngineTag、AdapterBadge、QualityScoreBadge、EngineFilter、EngineSummaryPanel）
- ✅ 所有页面使用统一组件，展示格式一致
- ✅ 修改展示规则只需修改组件，无需修改多个页面
- ✅ 提升了用户体验和维护效率

---

## 8. 所有禁止修改的边界

### 目标

明确 Stage3 的封板范围，确保后续开发不会破坏已有功能，保障系统稳定性和可追溯性。

### 内容

#### 8.1 文件级封板

**S3-A 封板文件**（禁止修改）：
- `apps/api/src/config/engine.config.ts` - 引擎配置读取逻辑
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - HTTP 适配器实现

**S3-B 封板文件**（禁止修改）：
- `apps/api/src/engine/engine-routing.service.ts` - 路由决策核心逻辑（如需扩展，应通过配置而非修改代码）

**Stage2 核心文件**（禁止修改）：
- `apps/api/src/job/job.service.ts` 中的 `getAndMarkNextPendingJob()` 方法
- `apps/api/src/orchestrator/orchestrator.service.ts` 中的调度核心逻辑
- `apps/api/src/novel-import/novel-import.controller.ts` 的核心导入逻辑
- `apps/workers/src/novel-analysis-processor.ts` 的分析处理逻辑

#### 8.2 行为级封板

**调度路径**（禁止修改）：
- ❌ 禁止修改 Job 状态流转机制（PENDING → RUNNING → RETRYING/FAILED）
- ❌ 禁止修改 Worker 离线恢复逻辑
- ❌ 禁止修改 Job 重试机制

**执行路径**（禁止修改）：
- ❌ 禁止修改 `EngineAdapter.invoke()` 的调用流程
- ❌ 禁止在 Adapter 内部实现重试循环（重试必须走 Job 重试系统）
- ❌ 禁止修改 NOVEL_ANALYSIS 的默认引擎绑定

**前端行为**（禁止修改）：
- ❌ 禁止前端通过 API 修改已有 Job 的 engineKey / engineVersion
- ❌ 禁止前端动态切换引擎配置
- ✅ 允许前端查看引擎信息（只读）
- ✅ 允许前端在创建新 Job 时选择引擎（通过后端 API）
- ✅ 允许前端通过 URL 参数筛选引擎（只读筛选）

#### 8.3 数据模型封板

**统一类型定义**（禁止修改已有字段）：
- ❌ 禁止修改 `JobWithEngineInfo` 的已有字段定义
- ❌ 禁止修改 `TaskGraphWithEngineInfo` 的已有字段定义
- ✅ 允许在现有类型基础上扩展新字段（向后兼容）

**统一抽取逻辑**（禁止修改）：
- ❌ 禁止修改 `JobService.extractEngineKeyFromJob()` 的提取逻辑
- ❌ 禁止修改 `JobService.extractEngineVersionFromJob()` 的提取逻辑
- ✅ 允许其他服务调用这些统一方法

### 关键结果

- ✅ 明确了所有封板文件和封板行为
- ✅ 保障了系统稳定性和可追溯性
- ✅ 为后续开发提供了清晰的边界约束

---

## 9. Stage3 交付物列表

### 目标

完整列出 Stage3 的所有交付物，包括文档文件、代码模块、类型定义、UI 组件等，便于后续维护和扩展。

### 内容

#### 9.1 文档文件

**总览文档**：
- `docs/STAGE3_OVERVIEW.md` - 《STAGE3 总览文档｜正式版（中文）》v2.0

**设计文档**：
- `docs/STAGE3_PLAN.md` - Stage3 总体规划
- `docs/STUDIO_ENGINE_INTEGRATION.md` - Studio 联动信息架构设计
- `docs/ENGINE_HTTP_CONFIG.md` - HTTP 引擎配置设计
- `docs/ENGINE_HTTP_INVOKE_DESIGN.md` - HTTP 调用路径设计

**完成报告**：
- `docs/S3A1_REVIEW_REPORT.md` - S3-A.1 封板报告
- `docs/S3_B3_COMPLETION_SUMMARY.md` - S3-B.3 完成总结
- `docs/S3_C1_COMPLETION_SUMMARY.md` - S3-C.1 完成总结
- `docs/S3_C2_COMPLETION_SUMMARY.md` - S3-C.2 完成总结
- `docs/S3_C3_EXECUTION_SUMMARY.md` - S3-C.3 Phase 1 执行总结

**进度跟踪**：
- `docs/S3_PROGRESS_AUTHORITATIVE.md` - 权威进度文档
- `docs/S3_PROGRESS_TRACKER.md` - 详细进度跟踪

#### 9.2 后端代码模块

**引擎配置与路由**：
- `apps/api/src/engine/engine-config-store.service.ts` - 配置存储服务
- `apps/api/src/engine/engine-routing.service.ts` - 路由决策层
- `apps/api/src/engine/engine-registry.service.ts` - 引擎注册表
- `apps/api/src/config/engine.config.ts` - 引擎配置读取（封板）
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - HTTP 适配器（封板）

**统一信息抽取**：
- `apps/api/src/job/job.service.ts` - Job 服务（统一引擎信息提取方法：`extractEngineKeyFromJob()`、`extractEngineVersionFromJob()`）

**API 扩展**：
- `apps/api/src/task/task-graph.controller.ts` - Task Graph API（扩展返回引擎信息）
- `apps/api/src/job/job.controller.ts` - Job 列表 API（扩展支持 engineKey 筛选）

**模块依赖**：
- `apps/api/src/task/task.module.ts` - 导入 JobModule（使用 forwardRef）
- `apps/api/src/orchestrator/orchestrator.module.ts` - 导入 JobModule
- `apps/api/src/worker/worker.module.ts` - 导入 JobModule（使用 forwardRef）

#### 9.3 前端代码模块

**统一 UI 组件**：
- `apps/web/src/components/engines/EngineTag.tsx` - 引擎标签组件
- `apps/web/src/components/engines/AdapterBadge.tsx` - 适配器标签组件
- `apps/web/src/components/quality/QualityScoreBadge.tsx` - 质量指标组件
- `apps/web/src/components/engines/EngineFilter.tsx` - 引擎筛选器
- `apps/web/src/components/engines/EngineSummaryPanel.tsx` - 质量摘要面板

**页面改造**：
- `apps/web/src/app/studio/jobs/page.tsx` - Job 列表页（使用统一组件）
- `apps/web/src/app/projects/[projectId]/import-novel/page.tsx` - 导入页（使用统一组件）
- `apps/web/src/app/tasks/[taskId]/graph/page.tsx` - Task Graph 页（使用统一组件）

#### 9.4 共享类型定义

**类型定义文件**：
- `packages/shared-types/src/jobs/job-with-engine-info.dto.ts` - Job 类型定义（JobWithEngineInfo、JobEngineMetrics、JobQualityScore）
- `packages/shared-types/src/tasks/task-graph-with-engine-info.dto.ts` - Task Graph 类型定义（TaskGraphWithEngineInfo、TaskGraphJobNode）

**导出文件**：
- `packages/shared-types/src/jobs/index.ts` - 导出 jobs 相关类型
- `packages/shared-types/src/tasks/index.ts` - 导出 tasks 相关类型（包含 TaskGraphWithEngineInfo）
- `packages/shared-types/src/index.ts` - 主索引文件（导出 jobs 模块）

#### 9.5 测试文件

**单元测试**：
- `apps/api/src/task/task-graph.controller.spec.ts` - Task Graph Controller 最小单元测试

### 关键结果

- ✅ 完整列出了所有文档文件（总览、设计、完成报告、进度跟踪）
- ✅ 完整列出了所有代码模块（后端、前端、共享类型）
- ✅ 所有交付物均已实现并通过验证
- ✅ 为后续维护和扩展提供了清晰的清单

---

## 10. 如何从 Stage3 平滑进入 Stage4

### 目标

明确 Stage3 为 Stage4 提供的基础能力，说明 Stage4 如何复用 Stage3 的成果，确保平滑升级。

### 内容

#### 10.1 Stage3 提供的基础能力

**引擎路由层**：
- `EngineRoutingService` 提供的基础路由能力
- 路由规则清晰，优先级明确
- 支持通过配置扩展路由策略

**引擎信息模型**：
- `JobWithEngineInfo` / `TaskGraphWithEngineInfo` 等统一类型
- 所有引擎信息字段已标准化（engineKey、engineVersion、adapterName）
- 前后端类型一致性得到保障

**质量与性能指标**：
- `qualityScore`、`metrics` 等字段已标准化
- 指标提取逻辑统一（`QualityScoreService.buildQualityScoreFromJob()`）
- 指标展示组件统一（`QualityScoreBadge`）

**统一展示组件**：
- `EngineTag`、`AdapterBadge`、`QualityScoreBadge` 等组件可直接复用
- URL 参数驱动的全局联动机制可直接复用

#### 10.2 Stage4 的升级方向

**S4-A：历史数据统计与引擎画像**
- 依赖：复用 Stage3 的 `JobWithEngineInfo` 数据和 `qualityScore` / `metrics` 字段
- 扩展：新增 `EngineProfileService` 进行统计聚合，不修改现有数据模型

**S4-B：规则路由**
- 依赖：复用 Stage3 的 `EngineRoutingService` 基础路由能力
- 扩展：在现有路由层之上增加策略层，不修改核心路由逻辑

**S4-C：多引擎并行对比**
- 依赖：复用 Stage3 的 `TaskGraphWithEngineInfo` 结构和统一展示组件
- 扩展：在 Task 层面支持多引擎模式，不修改单个 Job 的执行流程

**S4-D：A/B 实验与灰度**
- 依赖：复用 Stage3 的 URL 参数驱动机制和统一展示组件
- 扩展：在路由层增加实验路由，不修改现有路由核心逻辑

#### 10.3 升级路径

**Phase 1：数据基础**（S4-A）
- 基于 Stage3 的历史数据生成引擎画像
- 复用 Stage3 的质量/性能指标字段
- 复用 Stage3 的统一展示组件

**Phase 2：策略路由**（S4-B）
- 在 Stage3 的路由层之上增加策略层
- 复用 Stage3 的配置管理机制
- 复用 Stage3 的引擎信息模型

**Phase 3：对比与实验**（S4-C / S4-D）
- 复用 Stage3 的 Task Graph 结构和统一展示组件
- 复用 Stage3 的 URL 参数驱动机制
- 复用 Stage3 的质量/性能指标体系

### 关键结果

- ✅ Stage3 为 Stage4 提供了完整的数据基础和技术基础
- ✅ Stage4 可以通过新增模块和配置扩展，不破坏 Stage3 的核心实现
- ✅ 升级路径清晰，风险可控

---

## 附录

### A. 关键文件清单

**后端核心文件**：
- `apps/api/src/engine/engine-config-store.service.ts` - 配置存储服务
- `apps/api/src/engine/engine-routing.service.ts` - 路由决策层
- `apps/api/src/engine/engine-registry.service.ts` - 引擎注册表
- `apps/api/src/job/job.service.ts` - Job 服务（统一引擎信息提取）
- `apps/api/src/task/task-graph.controller.ts` - Task Graph API
- `apps/api/src/config/engine.config.ts` - 引擎配置读取（封板）
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - HTTP 适配器（封板）

**前端核心文件**：
- `apps/web/src/components/engines/EngineTag.tsx` - 引擎标签组件
- `apps/web/src/components/engines/AdapterBadge.tsx` - 适配器标签组件
- `apps/web/src/components/quality/QualityScoreBadge.tsx` - 质量指标组件
- `apps/web/src/components/engines/EngineFilter.tsx` - 引擎筛选器
- `apps/web/src/components/engines/EngineSummaryPanel.tsx` - 质量摘要面板
- `apps/web/src/app/studio/jobs/page.tsx` - Job 列表页
- `apps/web/src/app/projects/[projectId]/import-novel/page.tsx` - 导入页
- `apps/web/src/app/tasks/[taskId]/graph/page.tsx` - Task Graph 页

**共享类型文件**：
- `packages/shared-types/src/jobs/job-with-engine-info.dto.ts` - Job 类型定义
- `packages/shared-types/src/tasks/task-graph-with-engine-info.dto.ts` - Task Graph 类型定义

### B. 相关文档

**总览文档**：
- `docs/STAGE3_OVERVIEW.md` - 《STAGE3 总览文档｜正式版（中文）》v2.0

**设计文档**：
- `docs/STAGE3_PLAN.md` - Stage3 总体规划
- `docs/STUDIO_ENGINE_INTEGRATION.md` - Studio 联动信息架构设计
- `docs/ENGINE_HTTP_CONFIG.md` - HTTP 引擎配置设计
- `docs/ENGINE_HTTP_INVOKE_DESIGN.md` - HTTP 调用路径设计

**完成报告**：
- `docs/S3A1_REVIEW_REPORT.md` - S3-A.1 封板报告
- `docs/S3_B3_COMPLETION_SUMMARY.md` - S3-B.3 完成总结
- `docs/S3_C1_COMPLETION_SUMMARY.md` - S3-C.1 完成总结
- `docs/S3_C2_COMPLETION_SUMMARY.md` - S3-C.2 完成总结
- `docs/S3_C3_EXECUTION_SUMMARY.md` - S3-C.3 Phase 1 执行总结

**进度跟踪**：
- `docs/S3_PROGRESS_AUTHORITATIVE.md` - 权威进度文档
- `docs/S3_PROGRESS_TRACKER.md` - 详细进度跟踪

**后续规划**：
- `docs/STAGE4_PLAN.md` - Stage4 总体规划（多引擎差异化执行与智能选型）

### C. 术语表

| 术语 | 定义 |
|------|------|
| engineKey | 引擎标识，如 `default_novel_analysis`、`http_gemini_v1` |
| engineVersion | 引擎版本，如 `v1.0`、`v2.1` |
| adapterName | 适配器名称，如 `default_novel_analysis`、`http` |
| qualityScore | 质量评分，范围 0-1 |
| confidence | 置信度，范围 0-1 |
| RoutingLayer | 路由决策层，决定使用哪个引擎 |
| Config Store | 配置存储服务，管理引擎配置 |
| Version System | 版本系统，管理引擎版本配置 |
| Shared Types | 共享类型定义，确保前后端类型一致 |

---

## Stage3 → Stage4 技术依赖矩阵

### 目标

清晰展示 Stage3 的各个模块如何为 Stage4 提供基础能力，说明依赖关系和复用方式。

### 内容

| Stage3 模块 | Stage4 依赖项 | 复用方式 | 扩展方式 |
|------------|-------------|---------|---------|
| **EngineRoutingService** | S4-B（规则路由） | 复用基础路由决策逻辑 | 在现有路由层之上增加策略层 |
| **JobWithEngineInfo** | S4-A（引擎画像）<br>S4-B（规则路由）<br>S4-C（多引擎对比） | 复用统一类型定义 | 在现有类型基础上扩展新字段 |
| **TaskGraphWithEngineInfo** | S4-C（多引擎对比） | 复用统一类型定义 | 在现有类型基础上扩展新字段 |
| **qualityScore / metrics** | S4-A（引擎画像）<br>S4-B（规则路由）<br>S4-C（多引擎对比）<br>S4-D（A/B 实验） | 复用指标字段和提取逻辑 | 基于现有指标进行统计分析 |
| **QualityScoreService** | S4-A（引擎画像） | 复用指标提取逻辑 | 基于现有逻辑进行聚合统计 |
| **EngineTag / AdapterBadge / QualityScoreBadge** | S4-A（引擎画像）<br>S4-C（多引擎对比）<br>S4-D（A/B 实验） | 复用统一展示组件 | 直接使用，无需修改 |
| **EngineFilter** | S4-D（A/B 实验） | 复用 URL 参数驱动机制 | 扩展支持实验筛选参数 |
| **EngineConfigStoreService** | S4-B（规则路由） | 复用配置管理机制 | 扩展支持策略配置存储 |
| **Version System** | S4-B（规则路由） | 复用版本解析逻辑 | 扩展支持策略版本管理 |

### 关键结果

- ✅ 明确了 Stage3 各模块与 Stage4 的依赖关系
- ✅ 说明了复用方式和扩展方式，确保平滑升级
- ✅ 为 Stage4 的实现提供了清晰的技术路线

---

**文档版本**: v2.0  
**最后更新**: 2025-12-11  
**维护者**: 开发团队  
**文档状态**: ✅ 最终权威版本

---

*本文档是 Stage3 的最终权威输出，用于未来开发 Stage4、Stage5 的基础资料。所有内容基于当前代码与文档的真实情况，确保准确性和可追溯性。*
