# Stage4 规划文档

**生成时间**: 2025-12-11  
**最后更新**: 2025-12-11  
**规划模式**: PLAN + EXECUTE（S4-A 和 S4-B 骨架已完成）  
**前置条件**: Stage3 已完成并封板

---

## 1. Stage4 概述与目标

### 1.1 总体目标

在 Stage3 稳定基座之上，为系统引入**多引擎差异化执行能力**和**智能选型机制**。从单一引擎执行扩展到支持多引擎并行对比、A/B 测试、基于规则的智能路由，为不同场景选择最优引擎提供数据支撑和自动化能力。

**Stage4 的核心价值**：

1. **智能选型**：基于历史数据和质量/性能指标，自动选择最优引擎执行任务
2. **多引擎对比**：支持同一任务使用多个引擎并行执行，对比结果并选择最优
3. **A/B 测试**：支持按比例将任务分发到不同引擎，进行灰度实验和效果对比
4. **规则路由**：支持基于成本、质量、速度等维度的规则化路由策略

### 1.2 与 Stage3 的关系

Stage4 完全复用 Stage3 的成果，不修改 Stage3 的核心实现：

- **复用引擎路由层**：`EngineRoutingService` 提供的基础路由能力
- **复用引擎信息模型**：`JobWithEngineInfo` / `TaskGraphWithEngineInfo` 等统一类型
- **复用质量与性能指标**：`qualityScore`、`durationMs`、`costUsd`、`tokens` 等字段
- **复用统一展示组件**：`EngineTag`、`AdapterBadge`、`QualityScoreBadge` 等前端组件

Stage4 在 Stage3 之上**新增**的能力：

- 历史数据统计与引擎画像（只读统计）
- 规则化路由策略（基于成本/质量/速度等维度）
- 多引擎并行执行与结果对比
- A/B 实验与灰度分发机制

---

## 2. 前置依赖（完全复用 Stage3）

### 2.1 引擎路由层

**依赖组件**：`EngineRoutingService`（S3-B.3）

**复用能力**：

- 基础路由决策逻辑（`routeEngine(jobType, payload)`）
- 引擎配置解析（`resolveEngineConfig(engineKey, requestedVersion)`）
- 适配器获取（`EngineRegistry.getAdapter(engineKey)`）

**扩展方式**：在现有路由层之上增加策略层，不修改核心路由逻辑。

### 2.2 引擎信息模型

**依赖类型**：

- `JobWithEngineInfo` - Job 级别的引擎信息
- `TaskGraphWithEngineInfo` - Task Graph 级别的引擎信息
- `EngineSummary` - 引擎聚合统计信息

**复用字段**：

- `engineKey`、`engineVersion`、`adapterName` - 引擎标识
- `qualityScore.score`、`qualityScore.confidence` - 质量指标
- `metrics.durationMs`、`metrics.costUsd`、`metrics.tokens` - 性能指标

**扩展方式**：在现有类型基础上扩展，不修改已有字段定义。

### 2.3 质量与性能指标字段

**依赖字段**：

- `qualityScore.score`（0-1）- 质量评分
- `qualityScore.confidence`（0-1）- 置信度
- `metrics.durationMs`（毫秒）- 耗时
- `metrics.costUsd`（美元）- 成本
- `metrics.tokens`（数量）- Token 数

**复用能力**：

- 指标提取逻辑（`QualityScoreService.buildQualityScoreFromJob()`）
- 指标聚合逻辑（`QualityFeedbackService.evaluateQualityScores()`）
- 指标展示组件（`QualityScoreBadge`）

**扩展方式**：基于现有指标进行统计分析和策略决策，不修改指标提取逻辑。

---

## 3. Stage4 能力拆分

### 3.1 S4-A：历史数据统计与引擎画像（只读统计）

**目标**：基于历史 Job 数据，生成引擎画像和统计信息，为智能选型提供数据基础。

**核心能力**：

- 引擎性能统计（平均质量、平均耗时、平均成本、成功率）
- 引擎画像生成（引擎在不同任务类型下的表现特征）
- 历史趋势分析（引擎性能随时间的变化趋势）
- 对比分析（多引擎在同一任务类型下的对比）

**实现方式**：

- 新增 `EngineProfileService` - 引擎画像服务
- 新增 `GET /api/engines/:engineKey/profile` - 引擎画像 API
- 新增 `GET /api/engines/compare` - 引擎对比 API
- 新增 `EngineProfilePanel` - 引擎画像展示组件

**约束**：

- ❌ 不修改调度逻辑
- ❌ 不修改 Job 执行流程
- ✅ 所有统计均为只读查询
- ✅ 基于现有 `JobWithEngineInfo` 数据进行聚合

**输出**：

- 引擎画像数据模型（`EngineProfile`）
- 引擎对比数据模型（`EngineComparison`）
- 统计 API 接口定义

### 3.2 S4-B：规则路由（成本优先 / 质量优先 / 混合策略）

**目标**：在现有路由层之上增加规则化路由策略，支持基于成本、质量、速度等维度的智能选型。

**核心能力**：

- 成本优先策略（选择成本最低的引擎）
- 质量优先策略（选择质量最高的引擎）
- 速度优先策略（选择耗时最短的引擎）
- 混合策略（综合考虑成本、质量、速度，按权重选择）

**实现方式**：

- 新增 `RoutingStrategyService` - 路由策略服务
- 扩展 `EngineRoutingService`，增加策略路由方法
- 新增路由策略配置（`RoutingStrategyConfig`）
- 支持在 Task/Job payload 中指定路由策略

**路由策略示例**：

```typescript
// 成本优先
routingStrategy: 'cost-first'  // 选择 costUsd 最低的引擎

// 质量优先
routingStrategy: 'quality-first'  // 选择 qualityScore 最高的引擎

// 混合策略
routingStrategy: {
  type: 'weighted',
  weights: {
    cost: 0.3,
    quality: 0.5,
    speed: 0.2
  }
}
```

**约束**：

- ❌ 不修改 `EngineRoutingService` 的核心路由逻辑
- ❌ 不修改 Job 执行流程
- ✅ 通过策略层扩展，不破坏现有路由行为
- ✅ 策略路由仅在 Job 创建时生效，执行过程中不切换

**输出**：

- 路由策略数据模型（`RoutingStrategy`）
- 策略路由服务接口定义
- 策略配置 API 接口定义

### 3.3 S4-C：多引擎并行对比（同一 Task 生成多个 Job）

**目标**：支持一个 Task 同时使用多个引擎执行，对比结果并选择最优。

**核心能力**：

- 多引擎并行执行（一个 Task 生成多个 Job，每个 Job 使用不同引擎）
- 结果对比分析（对比多个引擎的执行结果，包括质量、性能、成本）
- 最优结果选择（基于对比结果自动选择最优引擎的输出）
- 对比报告生成（生成多引擎对比报告，用于决策）

**实现方式**：

- 新增 `MultiEngineComparisonService` - 多引擎对比服务
- 扩展 `TaskService.createTask()`，支持多引擎模式
- 新增 `GET /api/tasks/:taskId/comparison` - 对比结果 API
- 新增 `EngineComparisonView` - 对比结果展示组件

**工作流程**：

```
1. 创建 Task，指定多引擎模式：engines: ['http_gemini_v1', 'default_novel_analysis']
2. TaskService 为每个引擎创建一个 Job
3. 多个 Job 并行执行
4. 所有 Job 完成后，MultiEngineComparisonService 对比结果
5. 返回对比报告，包含最优引擎推荐
```

**约束**：

- ❌ 不修改单个 Job 的执行流程
- ❌ 不修改调度逻辑
- ✅ 通过 Task 层面扩展，不破坏现有 Job 执行
- ✅ 对比分析为只读操作，不修改已有 Job 数据

**输出**：

- 多引擎对比数据模型（`MultiEngineComparison`）
- 对比服务接口定义
- 对比结果 API 接口定义

### 3.4 S4-D：A/B 实验与灰度（按比例分发到不同引擎）

**目标**：支持按一定比例将任务分发到不同引擎，进行 A/B 测试和灰度实验。

**核心能力**：

- A/B 实验配置（定义实验组和对照组，以及分发比例）
- 灰度分发（按比例将任务分发到不同引擎）
- 实验数据收集（收集实验组和对照组的执行结果）
- 实验效果分析（对比实验组和对照组的效果差异）

**实现方式**：

- 新增 `ExperimentService` - 实验管理服务
- 新增 `ExperimentConfig` - 实验配置数据模型
- 扩展 `EngineRoutingService`，支持实验路由
- 新增 `GET /api/experiments/:experimentId/results` - 实验结果 API
- 新增 `ExperimentDashboard` - 实验看板组件

**实验配置示例**：

```typescript
experimentConfig: {
  experimentId: 'exp-001',
  name: 'Gemini vs Default Engine',
  groups: [
    { engineKey: 'http_gemini_v1', ratio: 0.5 },
    { engineKey: 'default_novel_analysis', ratio: 0.5 }
  ],
  metrics: ['qualityScore', 'costUsd', 'durationMs']
}
```

**约束**：

- ❌ 不修改调度逻辑
- ❌ 不修改 Job 执行流程
- ✅ 通过路由层扩展，不破坏现有路由行为
- ✅ 实验配置在 Task 创建时决定，执行过程中不切换

**输出**：

- 实验配置数据模型（`ExperimentConfig`）
- 实验结果数据模型（`ExperimentResult`）
- 实验管理服务接口定义
- 实验看板 API 接口定义

---

## 4. 技术边界与禁止修改项

### 4.1 Stage2 核心链路（禁止修改）

**调度系统**：

- ❌ `apps/api/src/job/job.service.ts` 中的 `getAndMarkNextPendingJob()` 方法
- ❌ `apps/api/src/orchestrator/orchestrator.service.ts` 中的调度核心逻辑
- ❌ Job 状态流转机制（PENDING → RUNNING → RETRYING/FAILED）
- ❌ Worker 离线恢复逻辑
- ❌ Job 重试机制

**执行路径**：

- ❌ `EngineAdapter.invoke()` 的调用流程
- ❌ `HttpEngineAdapter` 和 `LocalAdapter` 的实现
- ❌ NOVEL_ANALYSIS 的默认引擎绑定

### 4.2 Stage3 核心链路（禁止修改）

**封板文件**：

- ❌ `apps/api/src/config/engine.config.ts` - 引擎配置读取逻辑
- ❌ `apps/api/src/engine/adapters/http-engine.adapter.ts` - HTTP 适配器实现

**路由层核心**：

- ❌ `EngineRoutingService.routeEngine()` 的核心路由逻辑（可通过策略层扩展）
- ❌ `EngineConfigStoreService` 的配置合并逻辑
- ❌ `Version System` 的版本解析逻辑

**统一信息模型**：

- ❌ `JobWithEngineInfo` / `TaskGraphWithEngineInfo` 的已有字段定义
- ❌ `JobService.extractEngineKeyFromJob()` / `extractEngineVersionFromJob()` 的提取逻辑

### 4.3 允许的扩展方式

**新增模块**：

- ✅ 新增 `EngineProfileService` - 引擎画像服务
- ✅ 新增 `RoutingStrategyService` - 路由策略服务
- ✅ 新增 `MultiEngineComparisonService` - 多引擎对比服务
- ✅ 新增 `ExperimentService` - 实验管理服务

**扩展配置**：

- ✅ 在 Task/Job payload 中新增策略配置字段（如 `routingStrategy`、`experimentConfig`）
- ✅ 新增路由策略配置表（如 `RoutingStrategyConfig`）
- ✅ 新增实验配置表（如 `ExperimentConfig`）

**扩展 API**：

- ✅ 新增只读统计 API（如 `GET /api/engines/:engineKey/profile`）
- ✅ 新增对比分析 API（如 `GET /api/tasks/:taskId/comparison`）
- ✅ 新增实验管理 API（如 `GET /api/experiments/:experimentId/results`）

**扩展前端组件**：

- ✅ 新增 `EngineProfilePanel` - 引擎画像展示组件
- ✅ 新增 `EngineComparisonView` - 对比结果展示组件
- ✅ 新增 `ExperimentDashboard` - 实验看板组件

---

## 5. MVP 范围

### 5.1 第一轮 Stage4 完成标准

**必须完成的子能力**：

1. **S4-A：历史数据统计与引擎画像**（P0）
   - 引擎性能统计（平均质量、平均耗时、平均成本、成功率）
   - 引擎画像 API（`GET /api/engines/:engineKey/profile`）
   - 引擎对比 API（`GET /api/engines/compare`）
   - 引擎画像展示组件（`EngineProfilePanel`）

2. **S4-B：规则路由**（P0）
   - 成本优先策略
   - 质量优先策略
   - 混合策略（成本 + 质量 + 速度，权重可配置）
   - 策略路由服务（`RoutingStrategyService`）
   - 支持在 Task payload 中指定路由策略

3. **最小可用的对比工具**（P0）
   - 基于历史数据的引擎对比展示（使用 S4-A 的统计结果）
   - 简单的对比报告生成（质量、性能、成本三个维度）
   - 对比结果可视化（表格 + 简单图表）

**可选完成的子能力**（P1，不影响 MVP 完成度）：

- S4-C：多引擎并行对比（可在后续迭代中实现）
- S4-D：A/B 实验与灰度（可在后续迭代中实现）

### 5.2 MVP 验收标准

**功能验收**：

- ✅ 能够查询引擎画像（质量、性能、成本统计）
- ✅ 能够对比多个引擎的性能
- ✅ 能够基于规则策略自动选择引擎
- ✅ 能够查看引擎对比报告

**技术验收**：

- ✅ 不修改 Stage2/Stage3 核心链路
- ✅ 所有新增 API 均为只读查询（统计类）或配置类（策略配置）
- ✅ 不破坏现有功能
- ✅ 构建和测试通过

---

## 6. 后续可选增强

### 6.1 自动调参（P1，可选）

**能力**：基于历史数据自动调整路由策略的权重参数。

**实现方式**：

- 分析历史数据，找出最优权重组合
- 自动更新路由策略配置
- 支持手动回滚到之前的配置

### 6.2 自适应路由（P2，可选）

**能力**：根据实时性能数据动态调整路由策略。

**实现方式**：

- 监控引擎实时性能（成功率、平均耗时等）
- 当引擎性能下降时，自动切换到备用引擎
- 支持熔断机制（当引擎失败率过高时自动禁用）

### 6.3 智能推荐（P2，可选）

**能力**：基于任务特征和历史数据，推荐最优引擎。

**实现方式**：

- 分析任务特征（任务类型、数据量、复杂度等）
- 匹配历史相似任务的最优引擎
- 提供引擎推荐 API 和前端组件

### 6.4 高级可视化（P2，可选）

**能力**：提供更丰富的引擎对比和实验分析可视化。

**实现方式**：

- 性能趋势图表（时间序列）
- 多维度对比雷达图
- 实验效果热力图
- 成本效益分析图表

---

## 7. 依赖关系

### 7.1 Stage4 内部依赖

```
S4-A (历史数据统计) ✅ 基础能力
  ↓
S4-B (规则路由) ← 依赖 S4-A 的统计数据
  ↓
S4-C (多引擎并行对比) ← 依赖 S4-B 的路由策略
  ↓
S4-D (A/B 实验) ← 依赖 S4-C 的对比能力
```

### 7.2 Stage4 与 Stage3 的依赖

```
Stage3 成果（已封板）
  ├─ EngineRoutingService (路由层)
  ├─ JobWithEngineInfo / TaskGraphWithEngineInfo (统一类型)
  ├─ qualityScore / metrics (质量与性能指标)
  └─ 统一 UI 组件 (EngineTag / AdapterBadge / QualityScoreBadge)
         ↓
Stage4 新增能力
  ├─ EngineProfileService (引擎画像)
  ├─ RoutingStrategyService (策略路由)
  ├─ MultiEngineComparisonService (多引擎对比)
  └─ ExperimentService (实验管理)
```

---

## 8. 风险控制

### 8.1 性能风险

**风险点**：

- 历史数据统计查询可能影响数据库性能
- 多引擎并行执行可能增加系统负载

**缓解措施**：

- 使用数据库索引优化统计查询
- 限制统计查询的时间范围（如最近 30 天）
- 多引擎并行执行时限制并发数量
- 考虑引入缓存层（Redis）缓存热点统计数据

### 8.2 数据一致性风险

**风险点**：

- 多引擎并行执行时，结果可能不一致
- 实验数据收集可能遗漏或重复

**缓解措施**：

- 使用事务保证多引擎 Job 创建的原子性
- 使用唯一标识（experimentId）避免实验数据重复
- 定期校验实验数据的完整性

### 8.3 策略路由风险

**风险点**：

- 策略路由可能选择到性能较差的引擎
- 策略配置错误可能导致任务失败

**缓解措施**：

- 策略路由前先检查引擎可用性
- 提供策略配置验证机制
- 支持策略回滚（恢复到之前的配置）
- 记录策略路由的决策日志，便于问题排查

---

## 9. 总结

### 9.1 规划完成度

- ✅ **S4-A**：历史数据统计与引擎画像的设计框架已明确
- ✅ **S4-B**：规则路由的策略设计方向已确定
- ✅ **S4-C**：多引擎并行对比的实现思路已规划
- ✅ **S4-D**：A/B 实验与灰度的能力边界已明确

### 9.2 关键约束

1. **不动边界**：严格禁止修改 Stage2/Stage3 核心调度系统、路由层核心逻辑、统一信息模型
2. **扩展优先**：通过新增模块和配置扩展，不破坏现有功能
3. **只读优先**：MVP 阶段以只读统计和配置为主，暂不做复杂的执行层修改

### 9.3 下一步行动

1. **评审本文档**：确认规划方向和技术方案
2. **分批设计**：按照执行顺序，逐个批次完成详细设计文档
3. **进入执行**：设计文档通过后，分批进入 `MODE: EXECUTE` 实现代码

---

**文档状态**: ✅ 规划完成，待评审  
**后续文档**: 各批次的详细设计文档将在执行前生成

---

## 附录

### A. 相关文档

**Stage3 总览文档**：

- `docs/STAGE3_OVERVIEW.md` - 《STAGE3 总览文档｜正式版（中文）》v1.1

**Stage3 设计文档**：

- `docs/STAGE3_PLAN.md` - Stage3 总体规划
- `docs/STUDIO_ENGINE_INTEGRATION.md` - Studio 联动信息架构设计

**Stage3 完成报告**：

- `docs/S3A1_REVIEW_REPORT.md` - S3-A.1 封板报告
- `docs/S3_B3_COMPLETION_SUMMARY.md` - S3-B.3 完成总结
- `docs/S3_C3_EXECUTION_SUMMARY.md` - S3-C.3 Phase 1 执行总结

### B. 术语表

| 术语           | 定义                                               |
| -------------- | -------------------------------------------------- |
| 引擎画像       | 基于历史数据生成的引擎性能特征描述                 |
| 规则路由       | 基于预设规则（成本/质量/速度）选择引擎的路由策略   |
| 多引擎并行对比 | 同一任务使用多个引擎执行，对比结果并选择最优       |
| A/B 实验       | 按比例将任务分发到不同引擎，进行效果对比的实验方法 |
| 灰度分发       | 按一定比例将任务分发到不同引擎，逐步扩大范围       |

---

## 7. 当前实现详情（2025-12-11）

### 7.1 S4-A：引擎画像与统计（已完成）

**实现内容**：

- ✅ 新增 `EngineProfileService` - 引擎画像服务（只读聚合）
- ✅ 新增 `EngineProfileController` - 引擎画像 API 控制器
- ✅ 新增 `GET /api/engine-profile/summary` - 引擎画像统计 API
- ✅ 新增 `EngineProfilePanel` - 前端引擎画像面板组件
- ✅ 在 `/studio/jobs` 页面集成引擎画像面板（可折叠）
- ✅ 新增 `EngineProfileSummary` / `EngineProfileResponse` 类型定义（shared-types）
- ✅ 最小单元测试（`engine-profile.service.spec.ts`）

**关键实现点**：

- 使用 `JobService.extractEngineKeyFromJob()` 统一提取引擎信息
- 基于数据库聚合，不在内存中暴力扫描
- 支持按 `engineKey`、`projectId`、时间范围筛选
- 完全只读，不触发任何执行操作

**不变原则**：

- ✅ 不修改 Stage3 的任何核心逻辑
- ✅ 不修改 `JobWithEngineInfo` / `TaskGraphWithEngineInfo` 的已有字段
- ✅ 所有新功能通过新增模块实现

### 7.2 S4-B：策略路由层骨架（已完成）

**实现内容**：

- ✅ 新增 `EngineStrategyService` - 策略路由服务
- ✅ 新增 `StrategyDecision` / `StrategyContext` 接口定义
- ✅ 修改 `EngineRegistry.invoke()` - 先调用策略层，再调用路由层
- ✅ 在 `EngineModule` 中注册 `EngineStrategyService`
- ✅ 向后兼容：策略层不可用时，直接使用路由层

**关键实现点**：

- 当前版本：默认透传实现，不改变现有行为
- 调用链路：`EngineRegistry.invoke()` → `EngineStrategyService.decideStrategy()` → `EngineRoutingService.resolve()`
- 为后续扩展预留接口：`StrategyContext`、`StrategyDecision`、`strategyLabel`、`experimentId` 等

**不变原则**：

- ✅ 不修改 `EngineRoutingService` 的现有路由规则
- ✅ 不修改 `EngineAdapter.invoke()` 的调用流程
- ✅ 所有策略逻辑集中在 `EngineStrategyService` 中

### 7.3 后续扩展方向

**S4-B 后续实现**（待规划）：

- 规则路由策略（成本优先 / 质量优先 / 速度优先 / 混合策略）
- A/B 实验配置与流量分配
- 灰度分发机制
- 实验数据记录与效果评估

**S4-C / S4-D**（待规划）：

- 多引擎并行对比实现
- A/B 实验完整流程

---

**文档版本**: v1.1  
**维护者**: 开发团队  
**最后更新**: 2025-12-11
