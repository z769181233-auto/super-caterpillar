# S3-C.1 下一步执行建议

**批次**: S3-C.1 Studio/导入页联动信息架构  
**模式**: PLAN-only（仅文档设计，不写代码）  
**预计时间**: 2-3 天  
**前置条件**: ✅ S3-A 已完成，✅ S3-B 已完成

---

## 🎯 任务目标

设计如何在前端展示不同 engine 的任务和质量指标，规划 Task Graph / Monitor 的筛选维度，设计质量指标的展示方式。

---

## 📋 执行步骤建议

### 第一步：调研现有实现（1-2 小时）

**目标**: 了解现有 API 和前端页面的实现情况

**需要查看的文件**:

1. **后端 API 服务**:
   - `apps/api/src/task/task-graph.service.ts` - Task Graph 服务
   - `apps/api/src/task/engine-task.service.ts` - Engine Task 服务
   - `apps/api/src/quality/quality-score.service.ts` - 质量评分服务
   - `apps/api/src/task/task-graph.controller.ts` - Task Graph API 控制器
   - `apps/api/src/orchestrator/orchestrator.service.ts` - 调度统计服务

2. **前端页面**:
   - `apps/web/src/app/studio/jobs/page.tsx` - Studio Jobs 页面
   - `apps/web/src/app/monitor/workers/page.tsx` - Worker 监控页面
   - `apps/web/src/app/monitor/scheduler/page.tsx` - 调度监控页面
   - `apps/web/src/app/tasks/[taskId]/graph/page.tsx` - Task Graph 页面（如果存在）
   - `apps/web/src/app/projects/[projectId]/import-novel/page.tsx` - 导入页面（如果存在）

3. **API 客户端**:
   - `apps/web/src/lib/apiClient.ts` - API 客户端封装

**关键问题**:

- [ ] 现有 API 是否已经支持按 `engineKey` 筛选？
- [ ] Task Graph API 是否已经返回 `engineKey` 和 `adapterName`？
- [ ] Quality Score API 是否已经聚合了按 engine 的统计？
- [ ] 前端页面是否已经有筛选组件？

---

### 第二步：设计数据流信息架构（2-3 小时）

**目标**: 明确每个前端页面需要的数据来源和 API 调用

**需要设计的页面**:

#### 1. `/monitor/workers` - Worker 监控页面

- **当前状态**: 查看现有实现
- **增强需求**: 是否需要按 engine 维度展示 Worker 负载？
- **数据来源**: `GET /api/workers/monitor/stats`
- **设计要点**:
  - 是否需要显示每个 Worker 正在处理的 engine 分布？
  - 是否需要按 engine 统计 Worker 使用情况？

#### 2. `/monitor/scheduler` - 调度监控页面

- **当前状态**: 查看现有实现
- **增强需求**: 添加按 engine 维度的统计
- **数据来源**: `GET /api/orchestrator/monitor/stats`
- **设计要点**:
  - 按 engine 分组的 Job 状态统计（pending/running/failed）
  - 按 engine 的重试分布图表
  - 按 engine 的平均等待时间对比
- **API 扩展需求**:
  - 是否需要新增 `GET /api/orchestrator/monitor/stats?groupBy=engine`？
  - 或者在前端对现有数据进行分组？

#### 3. `/tasks/[taskId]/graph` - Task Graph 页面

- **当前状态**: 查看现有实现
- **增强需求**: 显示 engine 信息和质量指标
- **数据来源**: `GET /api/tasks/:taskId/graph`
- **设计要点**:
  - Task 信息中显示 `engineKey` 和 `adapterName`
  - Job 列表中显示每个 Job 的 `engineKey` 和质量指标
  - 显示 `qualityFeedback` 聚合结果
  - 支持按 engine 筛选 Job
- **API 扩展需求**:
  - 确认 `TaskGraphService.findTaskGraph()` 是否已经返回 `engineKey`？
  - 确认 `qualityScores` 和 `qualityFeedback` 是否已经包含在响应中？

#### 4. `/projects/[projectId]/import-novel` - 导入页面

- **当前状态**: 查看现有实现
- **增强需求**: 添加 engine 选择器和历史导入质量预览
- **数据来源**:
  - `GET /api/tasks?projectId=xxx&taskType=NOVEL_ANALYSIS` - 历史任务列表
  - `GET /api/engines` - 可用引擎列表（如果 S3-B 已实现）
- **设计要点**:
  - Engine 选择器（默认 `default_novel_analysis`，可选 HTTP 引擎）
  - 历史导入记录展示（最近 5 条）
  - 质量指标预览（avgScore, avgConfidence）
  - 不同 engine 的预估成本（如果 `metrics.costUsd` 可用）
- **API 扩展需求**:
  - 确认 `EngineTaskService.findEngineTasksByProject()` 是否已实现？
  - 是否需要新增质量指标聚合 API？

#### 5. `/studio/jobs` - Studio Jobs 页面

- **当前状态**: 查看现有实现
- **增强需求**: 添加 engine 筛选和展示
- **数据来源**: `GET /api/jobs?engineKey=xxx&jobType=xxx`
- **设计要点**:
  - Engine 筛选器（下拉选择）
  - Job 列表中显示 `engineKey` 和 `adapterName`
  - 质量指标列（score, confidence）
  - 支持按 engine 分组查看
- **API 扩展需求**:
  - 确认 `JobService.findAll()` 是否已支持 `engineKey` 筛选参数？

---

### 第三步：设计筛选维度（1-2 小时）

**目标**: 明确筛选逻辑和组合方式

**筛选维度设计**:

1. **按 engineKey 筛选**:
   - 筛选器类型: 下拉选择（全部 / default_novel_analysis / http_gemini_v1 / ...）
   - 数据来源: `GET /api/engines` 或从现有数据中提取唯一值
   - 应用页面: Studio Jobs, Monitor Scheduler, Task Graph

2. **按 jobType 筛选**（已有）:
   - 确认现有实现是否满足需求
   - 是否需要扩展？

3. **按 projectId 筛选**（已有）:
   - 确认现有实现是否满足需求
   - 是否需要扩展？

4. **组合筛选**:
   - engine + jobType + project 的组合筛选逻辑
   - URL 参数格式: `?engineKey=xxx&jobType=xxx&projectId=xxx`
   - 前端状态管理（React state 或 URL query params）

---

### 第四步：设计质量指标展示（2-3 小时）

**目标**: 设计质量指标的展示方式和 UI 组件

**质量指标数据来源**:

- `QualityScoreService.buildQualityScoreFromJob()` - 单个 Job 的质量评分
- `QualityFeedbackService.evaluateQualityScores()` - 聚合质量反馈

**展示方式设计**:

1. **表格展示**:
   - 质量指标列（score, confidence）
   - 排序功能（按 score 或 confidence 排序）
   - 颜色编码（高分绿色，低分红色）

2. **卡片展示**:
   - 质量指标卡片（avgScore, avgConfidence, total）
   - 用于汇总视图

3. **简单图表**:
   - 柱状图：不同 engine 的质量指标对比
   - 折线图：质量指标趋势（如果有时序数据）
   - 饼图：质量分布（优秀/良好/一般/差）

**UI 组件设计**:

1. **QualityMetrics 组件**:
   - Props: `scores: QualityScore[]`, `showChart?: boolean`
   - 功能: 显示质量指标表格/卡片/图表
   - 位置: `apps/web/src/components/quality/QualityMetrics.tsx`

2. **EngineFilter 组件**:
   - Props: `engines: Engine[]`, `selectedEngine?: string`, `onChange: (engineKey: string) => void`
   - 功能: Engine 筛选下拉选择器
   - 位置: `apps/web/src/components/engines/EngineFilter.tsx`

3. **TaskList 组件**（如果不存在）:
   - Props: `tasks: Task[]`, `filters: FilterOptions`
   - 功能: 任务列表展示，支持筛选
   - 位置: `apps/web/src/components/tasks/TaskList.tsx`

---

### 第五步：编写设计文档（2-3 小时）

**输出文档**: `docs/STUDIO_ENGINE_INTEGRATION.md`

**文档结构建议**:

```markdown
# Studio/导入页联动信息架构设计

## 1. 概述

- 设计目标
- 设计范围
- 约束条件

## 2. 数据流信息架构

### 2.1 前端页面 → API 调用映射表

### 2.2 每个页面的详细数据流

- /monitor/workers
- /monitor/scheduler
- /tasks/[taskId]/graph
- /projects/[projectId]/import-novel
- /studio/jobs

## 3. API 扩展需求

### 3.1 需要新增的 API 端点

### 3.2 需要扩展的现有 API

### 3.3 API 响应格式设计

## 4. 筛选维度设计

### 4.1 筛选器类型和位置

### 4.2 组合筛选逻辑

### 4.3 URL 参数格式

## 5. 质量指标展示设计

### 5.1 展示方式（表格/卡片/图表）

### 5.2 UI 组件设计

### 5.3 交互流程

## 6. UI 组件清单

### 6.1 需要新增的组件

### 6.2 需要修改的组件

### 6.3 组件 Props 和接口定义

## 7. 实现优先级

### 7.1 Phase 1: 核心功能（必须）

### 7.2 Phase 2: 增强功能（可选）

## 8. 风险与注意事项

### 8.1 性能考虑

### 8.2 数据一致性

### 8.3 向后兼容性
```

---

## ⚠️ 注意事项

### 1. 只读优先原则

- ✅ **允许**: 只读展示、简单筛选、查看详情
- ❌ **禁止**: 重跑 Job、取消 Job、切换引擎、在线编辑引擎配置

### 2. MVP 范围限制

- 不做复杂交互（如多引擎对比实验界面）
- 不做分页和时间区间筛选（Stage3 阶段限制）
- 所有聚合查询在单次请求中完成

### 3. 性能约束

- 监控 API 性能：只做单请求聚合视图
- 不实现分页（未来扩展）
- 不实现时间区间筛选（未来扩展）

### 4. 数据一致性

- 所有质量指标从后端 API 获取
- 不依赖前端计算
- 使用统一的类型定义（shared-types）

---

## 📅 时间安排建议

| 步骤     | 任务               | 预计时间      | 优先级 |
| -------- | ------------------ | ------------- | ------ |
| 1        | 调研现有实现       | 1-2 小时      | 高     |
| 2        | 设计数据流信息架构 | 2-3 小时      | 高     |
| 3        | 设计筛选维度       | 1-2 小时      | 中     |
| 4        | 设计质量指标展示   | 2-3 小时      | 高     |
| 5        | 编写设计文档       | 2-3 小时      | 高     |
| **总计** |                    | **8-13 小时** |        |

---

## ✅ 完成标准

设计文档完成后，需要满足以下条件：

1. ✅ 所有前端页面的数据流已明确
2. ✅ API 扩展需求已列出
3. ✅ 筛选维度设计已完成
4. ✅ 质量指标展示方式已确定
5. ✅ UI 组件清单和接口定义已完成
6. ✅ 实现优先级已明确
7. ✅ 风险与注意事项已识别

---

## 🚀 开始执行

**建议执行顺序**:

1. 先调研现有实现（了解现状）
2. 再设计数据流（明确需求）
3. 最后编写文档（输出成果）

**开始前检查清单**:

- [ ] 已阅读 `docs/STAGE3_PLAN.md` 中 S3-C.1 的相关章节
- [ ] 已了解 S3-A 和 S3-B 的实现内容
- [ ] 已准备好查看现有代码的时间

---

**文档状态**: 📝 执行建议  
**下一步**: 开始第一步（调研现有实现）
