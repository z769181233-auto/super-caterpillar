# Studio / 导入页 / 监控页 / TaskGraph 统一引擎信息架构设计

**文档类型**: PLAN-only（仅文档设计，不写代码）  
**批次**: S3-C.3  
**创建时间**: 2025-12-11  
**前置条件**: ✅ S3-A 已完成，✅ S3-B 已完成，✅ S3-C.2 已完成

---

## 1. 设计目标

### 1.1 核心目标

设计一套统一的引擎信息架构，确保所有前端页面对 `engineKey` / `engineVersion` / `adapterName` / `qualityScore` 的展示与数据流保持一致，实现：

1. **数据一致性**: 所有页面使用相同的数据结构和展示规范
2. **全局联动**: URL 参数驱动的筛选机制，`engineKey` 筛选在所有页面间同步
3. **统一体验**: 质量指标、引擎标签、适配器标识的展示格式统一
4. **可扩展性**: 支持未来新增引擎类型和页面，无需重复设计

### 1.2 设计范围

**覆盖页面**:
- `/studio/jobs` - Studio Jobs 列表页
- `/projects/[projectId]/import-novel` - 导入小说页
- `/monitor/scheduler` - 调度监控页
- `/monitor/workers` - Worker 监控页
- `/tasks/[taskId]/graph` - Task Graph 可视化页

**核心数据字段**:
- `engineKey`: 引擎标识（如 `default_novel_analysis`, `http_real_novel_analysis`）
- `engineVersion`: 引擎版本（如 `v1.0`, `v2.1`）
- `adapterName`: 适配器名称（如 `default_novel_analysis`, `http`）
- `qualityScore`: 质量评分（`score`, `confidence`）
- `metrics`: 性能指标（`durationMs`, `costUsd`, `tokens`）

### 1.3 设计约束

**必须遵守**:
- ❌ 禁止修改 S3-A / S3-B 封板文件（`engine.config.ts`, `http-engine.adapter.ts`）
- ❌ 禁止改变调度逻辑和 Job 执行流程
- ❌ 禁止修改数据库 Schema（除非明确要求）
- ✅ 所有修改必须是「只读展示」或「只读聚合 API」
- ✅ 保持向后兼容，不影响现有功能

---

## 2. 受影响页面与各自需要展示的数据

### 2.1 `/studio/jobs` - Studio Jobs 列表页

**当前状态**: ✅ 已实现基础功能（S3-C.2）

**需要展示的数据**:
- **列表列**:
  - `engineKey` (monospace 字体)
  - `engineVersion` (灰色小字)
  - `adapterName` (标签形式：http/local)
  - `qualityScore.score` (颜色编码)
  - `qualityScore.confidence` (可选，小字)
- **筛选器**: EngineFilter 组件（URL: `?engineKey=xxx`）
- **质量摘要**: EngineSummaryPanel（顶部）
- **分组视图**: 按 Engine / Version 分组（S3-C.2 已实现）

**数据来源 API**:
- `GET /api/jobs?engineKey=xxx&projectId=xxx&type=xxx` - Job 列表
- `GET /api/jobs/engine-summary?engineKey=xxx&projectId=xxx` - 质量摘要

**展示优先级**: P0（核心页面）

---

### 2.2 `/projects/[projectId]/import-novel` - 导入小说页

**当前状态**: ✅ 已实现基础功能（S3-C.2）

**需要展示的数据**:
- **右侧栏**:
  - EngineSummaryPanel（质量摘要）
- **历史对比模块**:
  - Recent Engine Comparison（过去 5 条分析任务）
  - 展示：`engineKey`, `engineVersion`, `score`, `costUsd`, `durationMs`, HTTP 标签
- **分析任务列表**:
  - `engineKey`, `engineVersion`, `qualityScore.score`

**数据来源 API**:
- `GET /api/jobs/engine-summary?engineKey=xxx&projectId=xxx` - 质量摘要
- `GET /api/jobs?projectId=xxx&type=NOVEL_ANALYSIS*` - 历史任务（用于对比）

**展示优先级**: P0（核心页面）

---

### 2.3 `/monitor/scheduler` - 调度监控页

**当前状态**: ✅ 已实现基础功能（S3-C.1）

**需要展示的数据**:
- **筛选器**: EngineFilter 组件（URL: `?engineKey=xxx`）
- **统计卡片**:
  - 按 engine 分组的 Job 状态统计（pending/running/failed）
  - 按 engine 的重试分布
  - 按 engine 的平均等待时间
- **引擎维度统计**:
  - 每个 engine 的 Job 数量、成功率、平均耗时

**数据来源 API**:
- `GET /api/orchestrator/monitor/stats?engineKey=xxx` - 调度统计（需扩展支持 engineKey 筛选）

**展示优先级**: P1（监控页面）

**API 扩展需求**:
- 需要扩展 `OrchestratorService.getStats()` 支持 `engineKey` 筛选参数
- 需要扩展返回结构，包含按 engine 分组的统计

---

### 2.4 `/monitor/workers` - Worker 监控页

**当前状态**: ⏳ 待实现

**需要展示的数据**:
- **Worker 列表**:
  - 每个 Worker 正在处理的 engine 分布（可选）
  - Worker 的 engine 使用统计（可选）
- **筛选器**: EngineFilter 组件（URL: `?engineKey=xxx`，可选）

**数据来源 API**:
- `GET /api/workers/monitor/stats?engineKey=xxx` - Worker 统计（需扩展支持 engineKey 筛选）

**展示优先级**: P2（可选功能）

**API 扩展需求**:
- 需要扩展 `WorkerService.getWorkerMonitorSnapshot()` 支持 `engineKey` 筛选参数
- 需要扩展返回结构，包含按 engine 分组的 Worker 负载

---

### 2.5 `/tasks/[taskId]/graph` - Task Graph 可视化页

**当前状态**: ✅ 已实现基础功能（S3-C.2）

**需要展示的数据**:
- **Job 节点标签**:
  - Engine 标签：`<engineKey>@<version>` (蓝色背景)
  - Adapter 标签：http（紫色）/ local（灰色）
  - 质量分数标签：score（颜色区分高/中/低）
- **Job 列表表格**:
  - `engineKey`, `engineVersion`, `adapterName`, `qualityScore.score`
- **筛选器**: EngineFilter 组件（URL: `?engineKey=xxx`）

**数据来源 API**:
- `GET /api/tasks/:taskId/graph` - Task Graph（需扩展返回 engineKey, engineVersion, adapterName）
- `GET /api/tasks/:taskId/quality-scores` - 质量评分（如果单独接口）

**展示优先级**: P0（核心页面）

**API 扩展需求**:
- 需要扩展 `TaskGraphService.findTaskGraph()` 返回结构，包含每个 Job 的 `engineKey`, `engineVersion`, `adapterName`
- 需要扩展 `TaskGraphController` 返回 `qualityScores` 和 `qualityFeedback`

---

## 3. 统一的数据流结构（后端 → 前端）

### 3.1 核心数据模型

#### 3.1.1 Job 数据模型（后端 → 前端）

```typescript
interface JobWithEngineInfo {
  // 基础字段
  id: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  
  // S3-C.3: 引擎信息（统一字段）
  engineKey: string;              // 引擎标识（必填，从 payload.engineKey 或默认引擎提取）
  engineVersion: string | null;   // 引擎版本（可选，从 payload.engineVersion 提取）
  adapterName: string;            // 适配器名称（必填，从 adapter.name 或 engineKey 提取）
  
  // S3-C.3: 质量指标（统一字段）
  qualityScore: {
    score: number | null;         // 质量评分（0-1，从 payload.result.quality.score 提取）
    confidence: number | null;    // 置信度（0-1，从 payload.result.quality.confidence 提取）
  } | null;
  
  // S3-C.3: 性能指标（统一字段）
  metrics: {
    durationMs: number | null;    // 耗时（毫秒，从 payload.result.metrics.durationMs 提取）
    costUsd: number | null;        // 成本（美元，从 payload.result.metrics.costUsd 提取）
    tokens: number | null;         // Token 数（从 payload.result.metrics.tokens 提取）
  } | null;
}
```

#### 3.1.2 Engine Summary 数据模型（后端 → 前端）

```typescript
interface EngineSummary {
  engineKey: string;
  totalJobs: number;              // 总任务数
  avgScore: number | null;        // 平均评分
  avgConfidence: number | null;   // 平均置信度
  successRate: number;            // 成功率（0-1）
  avgDurationMs: number | null;   // 平均耗时（毫秒）
  avgCostUsd: number | null;      // 平均成本（美元）
}
```

#### 3.1.3 Task Graph 数据模型（后端 → 前端）

```typescript
interface TaskGraphWithEngineInfo {
  taskId: string;
  projectId: string;
  taskType: string;
  status: string;
  
  // S3-C.3: 扩展 Job 节点，包含引擎信息
  jobs: Array<{
    jobId: string;
    jobType: string;
    status: string;
    
    // 引擎信息
    engineKey: string;
    engineVersion: string | null;
    adapterName: string;
    
    // 质量指标
    qualityScore: {
      score: number | null;
      confidence: number | null;
    } | null;
    
    // 性能指标
    metrics: {
      durationMs: number | null;
      costUsd: number | null;
    } | null;
  }>;
  
  // 质量反馈聚合（可选）
  qualityFeedback?: {
    avgScore: number | null;
    avgConfidence: number | null;
    total: number;
  };
}
```

### 3.2 数据提取逻辑（后端统一实现）

#### 3.2.1 engineKey 提取优先级

```
1. job.payload.engineKey (显式指定)
2. EngineRegistry.getDefaultEngineKeyForJobType(job.type) (默认映射)
3. 'default_novel_analysis' (降级默认)
```

**实现位置**: `JobService.extractEngineKeyFromJob()` (已实现，S3-C.1)

#### 3.2.2 engineVersion 提取优先级

```
1. job.payload.engineVersion (显式指定)
2. job.engineConfig.versionName (从配置读取)
3. null (无版本)
```

**实现位置**: `JobService.extractEngineVersionFromJob()` (已实现，S3-C.1)

#### 3.2.3 adapterName 提取逻辑

```
1. adapter.name (从 EngineAdapter 实例获取)
2. engineKey (降级使用 engineKey)
```

**实现位置**: `QualityScoreService.buildQualityScoreFromJob()` (已实现)

#### 3.2.4 qualityScore 提取逻辑

```
从 job.payload.result.quality 读取：
- score: payload.result.quality.score
- confidence: payload.result.quality.confidence
```

**实现位置**: `QualityScoreService.extractQuality()` (已实现)

### 3.3 API 响应格式规范

#### 3.3.1 GET /api/jobs

**请求参数**:
```typescript
{
  engineKey?: string;      // 筛选 engineKey
  projectId?: string;      // 筛选项目
  type?: string;          // 筛选 JobType
  page?: number;
  pageSize?: number;
}
```

**响应格式**:
```typescript
{
  success: true,
  data: {
    jobs: JobWithEngineInfo[];  // 包含 engineKey, engineVersion, adapterName, qualityScore
    total: number;
    page: number;
    pageSize: number;
  }
}
```

#### 3.3.2 GET /api/jobs/engine-summary

**请求参数**:
```typescript
{
  engineKey: string;      // 必填
  projectId?: string;      // 可选
}
```

**响应格式**:
```typescript
{
  success: true,
  data: EngineSummary
}
```

#### 3.3.3 GET /api/tasks/:taskId/graph

**响应格式**:
```typescript
{
  success: true,
  data: TaskGraphWithEngineInfo  // 包含 jobs[].engineKey, engineVersion, adapterName, qualityScore
}
```

#### 3.3.4 GET /api/orchestrator/monitor/stats

**请求参数**:
```typescript
{
  engineKey?: string;     // 新增：筛选 engineKey
}
```

**响应格式**:
```typescript
{
  success: true,
  data: {
    jobs: {
      total: number;
      byStatus: Record<JobStatus, number>;
      byEngine?: Record<string, {  // 新增：按 engine 分组
        total: number;
        byStatus: Record<JobStatus, number>;
      }>;
    };
    // ... 其他统计字段
  }
}
```

---

## 4. URL 参数驱动的筛选设计（engineKey 必须全局联动）

### 4.1 URL 参数规范

**统一参数名**: `engineKey`

**URL 格式**:
```
/studio/jobs?engineKey=default_novel_analysis
/monitor/scheduler?engineKey=http_real_novel_analysis
/tasks/[taskId]/graph?engineKey=default_novel_analysis
/projects/[projectId]/import-novel?engineKey=http_real_novel_analysis
```

**参数值**:
- `null` 或不存在: 显示所有引擎的数据
- `engineKey`: 只显示指定引擎的数据（如 `default_novel_analysis`, `http_real_novel_analysis`）

### 4.2 全局联动机制

#### 4.2.1 EngineFilter 组件（统一筛选器）

**组件位置**: `apps/web/src/components/engines/EngineFilter.tsx` (已实现，S3-C.1)

**功能**:
- 从 `/api/engines` 读取所有可用引擎
- 下拉选择器，支持"全部"选项
- 选择后更新 URL Query: `?engineKey=xxx`
- 与 URL Query 同步（支持浏览器前进/后退）

**使用方式**:
```tsx
<EngineFilter 
  queryParam="engineKey"  // 默认值
  showAll={true}         // 显示"全部"选项
  defaultValue={null}    // 默认选中值
/>
```

#### 4.2.2 页面级联动实现

**所有页面必须**:
1. 使用 `useSearchParams()` 读取 `engineKey` 参数
2. 在 `useEffect` 中监听 URL 变化，自动刷新数据
3. 将 `engineKey` 参数传递给所有 API 调用

**实现示例** (已在 S3-C.2 实现):
```tsx
// 在页面组件中
const searchParams = useSearchParams();
const engineKey = searchParams?.get('engineKey');

// 监听 URL 变化，自动刷新
useEffect(() => {
  const urlEngineKey = searchParams?.get('engineKey');
  if (urlEngineKey !== filters.engineKey) {
    setFilters(prev => ({ ...prev, engineKey: urlEngineKey, page: 1 }));
  }
}, [searchParams]);

// API 调用时传递 engineKey
const result = await jobApi.listJobs({
  ...filters,
  engineKey: filters.engineKey || undefined,
});
```

### 4.3 跨页面导航联动

**场景**: 用户从 `/studio/jobs?engineKey=xxx` 导航到 `/tasks/[taskId]/graph`

**预期行为**:
- 如果目标页面支持 `engineKey` 筛选，自动继承 URL 参数
- 如果目标页面不支持，忽略参数（不影响功能）

**实现方式**:
- 使用 Next.js `Link` 组件时，保留当前 URL 参数：
```tsx
<Link href={`/tasks/${taskId}/graph?${searchParams.toString()}`}>
  查看 Task Graph
</Link>
```

---

## 5. 质量指标展示规范（颜色、数值、格式）

### 5.1 质量评分 (score) 展示规范

#### 5.1.1 数值范围
- **范围**: 0.0 - 1.0
- **显示格式**: 保留 2 位小数（如 `0.85`）
- **无数据**: 显示 `-` 或 `N/A`

#### 5.1.2 颜色编码

| 分数范围 | 颜色 | 含义 | 使用场景 |
|---------|------|------|---------|
| `score >= 0.8` | 绿色 (`#4CAF50`) | 优秀 | 表格单元格、标签背景 |
| `0.6 <= score < 0.8` | 黄色/橙色 (`#FF9800`) | 良好 | 表格单元格、标签背景 |
| `score < 0.6` | 红色 (`#F44336`) | 需改进 | 表格单元格、标签背景 |
| `score === null` | 灰色 (`#999`) | 无数据 | 表格单元格、标签文本 |

#### 5.1.3 展示组件

**表格单元格**:
```tsx
{job.qualityScore?.score !== null ? (
  <span style={{ 
    color: job.qualityScore.score >= 0.8 ? '#4CAF50' 
         : job.qualityScore.score >= 0.6 ? '#FF9800' 
         : '#F44336' 
  }}>
    {job.qualityScore.score.toFixed(2)}
  </span>
) : (
  '-'
)}
```

**标签形式** (Task Graph):
```tsx
<span className={`px-2 py-0.5 rounded text-xs font-semibold ${
  score >= 0.8 ? 'bg-green-50 text-green-700'
  : score >= 0.6 ? 'bg-yellow-50 text-yellow-700'
  : 'bg-red-50 text-red-700'
}`}>
  Score: {score.toFixed(2)}
</span>
```

### 5.2 置信度 (confidence) 展示规范

#### 5.2.1 数值范围
- **范围**: 0.0 - 1.0
- **显示格式**: 保留 2 位小数（如 `0.92`）
- **无数据**: 显示 `-` 或 `N/A`

#### 5.2.2 展示方式
- **主要展示**: 不单独使用颜色编码（避免与 score 混淆）
- **辅助展示**: 在 score 下方显示小字（灰色）
- **格式**: `置信度: 0.92`

**示例**:
```tsx
<div>
  <span style={{ color: scoreColor }}>评分: {score.toFixed(2)}</span>
  {confidence !== null && (
    <div style={{ fontSize: '0.75rem', color: '#666' }}>
      置信度: {confidence.toFixed(2)}
    </div>
  )}
</div>
```

### 5.3 性能指标展示规范

#### 5.3.1 耗时 (durationMs)

**格式**:
- `< 1000ms`: 显示为 `XXXms`（如 `856ms`）
- `>= 1000ms`: 显示为 `X.Xs`（如 `3.2s`）

**颜色**: 默认黑色，无特殊颜色编码

**示例**:
```tsx
{durationMs !== null ? (
  durationMs < 1000 
    ? `${Math.round(durationMs)}ms`
    : `${(durationMs / 1000).toFixed(1)}s`
) : '-'}
```

#### 5.3.2 成本 (costUsd)

**格式**: 保留 4 位小数，显示为 `$X.XXXX`（如 `$0.0123`）

**颜色**: 默认黑色，无特殊颜色编码

**示例**:
```tsx
{costUsd !== null ? `$${costUsd.toFixed(4)}` : '-'}
```

#### 5.3.3 Token 数 (tokens)

**格式**: 整数，显示为 `XXX tokens`（如 `1250 tokens`）

**颜色**: 默认黑色，无特殊颜色编码

**示例**:
```tsx
{tokens !== null ? `${tokens} tokens` : '-'}
```

### 5.4 成功率 (successRate) 展示规范

#### 5.4.1 数值范围
- **范围**: 0.0 - 1.0
- **显示格式**: 百分比，保留 1 位小数（如 `95.5%`）

#### 5.4.2 颜色编码

| 成功率范围 | 颜色 | 含义 |
|-----------|------|------|
| `>= 0.9` | 绿色 (`#4CAF50`) | 优秀 |
| `0.7 <= rate < 0.9` | 黄色/橙色 (`#FF9800`) | 良好 |
| `< 0.7` | 红色 (`#F44336`) | 需改进 |

**示例**:
```tsx
<span style={{ 
  color: successRate >= 0.9 ? '#4CAF50' 
       : successRate >= 0.7 ? '#FF9800' 
       : '#F44336' 
}}>
  {(successRate * 100).toFixed(1)}%
</span>
```

---

## 6. UI 组件清单

### 6.1 已实现组件（S3-C.1 / S3-C.2）

#### 6.1.1 EngineFilter

**位置**: `apps/web/src/components/engines/EngineFilter.tsx`

**功能**:
- 从 `/api/engines` 读取引擎列表
- 下拉选择器，支持"全部"选项
- URL Query 同步（`?engineKey=xxx`）
- 浏览器前进/后退支持

**Props**:
```typescript
interface EngineFilterProps {
  queryParam?: string;        // 默认 'engineKey'
  showAll?: boolean;          // 默认 true
  defaultValue?: string | null;
  onChange?: (engineKey: string | null) => void;
  className?: string;
}
```

**使用场景**: 所有需要引擎筛选的页面

---

#### 6.1.2 EngineSummaryPanel

**位置**: `apps/web/src/components/engines/EngineSummaryPanel.tsx`

**功能**:
- 从 URL Query 读取 `engineKey`
- 调用 `/api/jobs/engine-summary` 获取聚合数据
- 展示质量摘要（avgScore, avgConfidence, successRate, avgDurationMs, avgCostUsd）

**Props**:
```typescript
interface EngineSummaryPanelProps {
  projectId?: string;         // 可选，用于项目级筛选
  className?: string;
  showTitle?: boolean;        // 默认 true
}
```

**使用场景**: 
- `/studio/jobs` 顶部
- `/projects/[projectId]/import-novel` 右侧栏

---

### 6.2 待实现组件（S3-C.3 规划）

#### 6.2.1 EngineJobGroupView

**位置**: `apps/web/src/components/engines/EngineJobGroupView.tsx` (待创建)

**功能**:
- Job 列表按 Engine / Version 分组展示
- 支持折叠/展开分组
- 支持分组内排序

**Props**:
```typescript
interface EngineJobGroupViewProps {
  jobs: JobWithEngineInfo[];
  groupBy: 'engine' | 'version' | 'none';  // 分组方式
  onJobClick?: (job: JobWithEngineInfo) => void;
  renderJobRow: (job: JobWithEngineInfo) => React.ReactNode;
}
```

**使用场景**: `/studio/jobs` 分组视图（S3-C.2 已实现基础版本，可优化）

---

#### 6.2.2 EngineTag

**位置**: `apps/web/src/components/engines/EngineTag.tsx` (待创建)

**功能**:
- 统一的引擎标签展示组件
- 显示 `engineKey@version` 格式
- 统一的样式和颜色

**Props**:
```typescript
interface EngineTagProps {
  engineKey: string;
  engineVersion?: string | null;
  adapterName?: string;
  size?: 'sm' | 'md' | 'lg';
  showAdapter?: boolean;      // 是否显示适配器标签
}
```

**使用场景**: 
- Task Graph Job 节点标签
- Job 列表中的引擎列
- 历史对比卡片

---

#### 6.2.3 QualityScoreBadge

**位置**: `apps/web/src/components/quality/QualityScoreBadge.tsx` (待创建)

**功能**:
- 统一的质量评分标签组件
- 自动颜色编码（绿色/黄色/红色）
- 支持 score 和 confidence 展示

**Props**:
```typescript
interface QualityScoreBadgeProps {
  score: number | null;
  confidence?: number | null;
  showConfidence?: boolean;   // 是否显示置信度
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'text';  // 标签形式或文本形式
}
```

**使用场景**: 
- Task Graph Job 节点标签
- Job 列表中的质量评分列
- 历史对比卡片

---

#### 6.2.4 AdapterBadge

**位置**: `apps/web/src/components/engines/AdapterBadge.tsx` (待创建)

**功能**:
- 统一的适配器标签组件
- HTTP 适配器：紫色标签
- Local 适配器：灰色标签

**Props**:
```typescript
interface AdapterBadgeProps {
  adapterName: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**使用场景**: 
- Task Graph Job 节点标签
- Job 列表中的适配器列

---

### 6.3 组件依赖关系

```
EngineFilter (已实现)
  ↓
EngineSummaryPanel (已实现)
  ↓
EngineJobGroupView (待实现)
  ├─ EngineTag (待实现)
  ├─ QualityScoreBadge (待实现)
  └─ AdapterBadge (待实现)
```

---

## 7. 页面级信息架构图（纯文档，禁止写代码）

### 7.1 `/studio/jobs` 页面信息架构

```
┌─────────────────────────────────────────────────────────────┐
│ /studio/jobs?engineKey=xxx                                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [EngineFilter]  [项目筛选]  [类型筛选]  [状态筛选]          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ EngineSummaryPanel (质量摘要)                        │    │
│  │ - 总任务数: 100                                      │    │
│  │ - 成功率: 95.5% (绿色)                               │    │
│  │ - 平均评分: 0.85 (绿色)                             │    │
│  │ - 平均置信度: 0.92                                   │    │
│  │ - 平均耗时: 3.2s                                     │    │
│  │ - 平均成本: $0.0123                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  [按 Engine 分组] [按 Version 分组] [取消分组]                │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Job 列表表格                                          │    │
│  │ ┌─────┬──────┬──────┬────────┬────────┬──────┐      │    │
│  │ │ ID  │ 类型 │ 状态 │ 引擎   │ 版本   │ 评分 │      │    │
│  │ ├─────┼──────┼──────┼────────┼────────┼──────┤      │    │
│  │ │ ... │ ...  │ ...  │ engine │ v1.0   │ 0.85 │      │    │
│  │ │     │      │      │ @v1.0  │        │(绿色)│      │    │
│  │ └─────┴──────┴──────┴────────┴────────┴──────┘      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

数据流:
1. 页面加载 → 读取 URL ?engineKey=xxx
2. 调用 GET /api/jobs?engineKey=xxx → 获取 Job 列表
3. 调用 GET /api/jobs/engine-summary?engineKey=xxx → 获取质量摘要
4. 用户切换 EngineFilter → 更新 URL → 自动刷新数据
```

---

### 7.2 `/projects/[projectId]/import-novel` 页面信息架构

```
┌─────────────────────────────────────────────────────────────┐
│ /projects/[projectId]/import-novel?engineKey=xxx            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [左侧主要内容区]                    [右侧栏]                 │
│                                                               │
│  ┌──────────────────────┐          ┌──────────────────┐   │
│  │ 上传区域              │          │ EngineSummaryPanel│   │
│  │ - 文件上传            │          │ (质量摘要)        │   │
│  │ - 基本信息表单        │          │ - 总任务数        │   │
│  │   - 小说名            │          │ - 成功率          │   │
│  │   - 作者              │          │ - 平均评分        │   │
│  │   - 引擎选择器        │          │ - 平均耗时        │   │
│  │   [EngineFilter]      │          │ - 平均成本        │   │
│  └──────────────────────┘          └──────────────────┘   │
│                                                               │
│  ┌──────────────────────┐                                   │
│  │ Recent Engine         │                                   │
│  │ Comparison           │                                   │
│  │ ┌──────┬──────┬────┐ │                                   │
│  │ │引擎  │版本  │评分│ │                                   │
│  │ ├──────┼──────┼────┤ │                                   │
│  │ │engine│ v1.0 │0.85│ │                                   │
│  │ │@v1.0 │      │(绿)│ │                                   │
│  │ │[http]│      │    │ │                                   │
│  │ └──────┴──────┴────┘ │                                   │
│  └──────────────────────┘                                   │
│                                                               │
│  ┌──────────────────────┐                                   │
│  │ 分析任务列表          │                                   │
│  │ - engineKey           │                                   │
│  │ - engineVersion       │                                   │
│  │ - qualityScore        │                                   │
│  └──────────────────────┘                                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

数据流:
1. 页面加载 → 读取 URL ?engineKey=xxx
2. 调用 GET /api/jobs/engine-summary?engineKey=xxx&projectId=xxx → 质量摘要
3. 调用 GET /api/jobs?projectId=xxx&type=NOVEL_ANALYSIS* → 历史任务（用于对比）
4. 用户切换 EngineFilter → 更新 URL → 自动刷新数据
```

---

### 7.3 `/monitor/scheduler` 页面信息架构

```
┌─────────────────────────────────────────────────────────────┐
│ /monitor/scheduler?engineKey=xxx                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [EngineFilter]  [刷新按钮]                                   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 调度统计（按 engine 分组）                            │    │
│  │                                                       │    │
│  │ 全部引擎:                                             │    │
│  │ - PENDING: 10                                        │    │
│  │ - RUNNING: 5                                         │    │
│  │ - FAILED: 2                                          │    │
│  │                                                       │    │
│  │ default_novel_analysis:                               │    │
│  │ - PENDING: 8                                         │    │
│  │ - RUNNING: 3                                         │    │
│  │ - FAILED: 1                                          │    │
│  │                                                       │    │
│  │ http_real_novel_analysis:                            │    │
│  │ - PENDING: 2                                         │    │
│  │ - RUNNING: 2                                         │    │
│  │ - FAILED: 1                                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

数据流:
1. 页面加载 → 读取 URL ?engineKey=xxx
2. 调用 GET /api/orchestrator/monitor/stats?engineKey=xxx → 调度统计
3. 如果 engineKey 存在，只显示该引擎的统计
4. 如果 engineKey 不存在，显示所有引擎的统计（按 engine 分组）
5. 用户切换 EngineFilter → 更新 URL → 自动刷新数据
```

---

### 7.4 `/tasks/[taskId]/graph` 页面信息架构

```
┌─────────────────────────────────────────────────────────────┐
│ /tasks/[taskId]/graph?engineKey=xxx                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [EngineFilter]  [Task 信息]                                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Task Graph 可视化区域                                 │    │
│  │                                                       │    │
│  │  [Task Node]                                         │    │
│  │       │                                               │    │
│  │    [Job Node 1]  [Job Node 2]  [Job Node 3]         │    │
│  │    engine@v1.0      engine@v2.0    engine@v1.0       │    │
│  │    [http]           [local]        [http]            │    │
│  │    Score: 0.85      Score: 0.92    Score: 0.78       │    │
│  │    (绿色)           (绿色)         (黄色)            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Job 列表表格（已筛选）                                │    │
│  │ ┌─────┬──────┬────────┬────────┬──────┐              │    │
│  │ │ ID  │ 类型 │ 引擎   │ 版本   │ 评分 │              │    │
│  │ ├─────┼──────┼────────┼────────┼──────┤              │    │
│  │ │ ... │ ...  │ engine │ v1.0   │ 0.85 │              │    │
│  │ │     │      │ @v1.0  │        │(绿色)│              │    │
│  │ │     │      │ [http]  │        │      │              │    │
│  │ └─────┴──────┴────────┴────────┴──────┘              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

数据流:
1. 页面加载 → 读取 URL ?engineKey=xxx
2. 调用 GET /api/tasks/:taskId/graph → Task Graph（包含 engineKey, engineVersion, adapterName, qualityScore）
3. 如果 engineKey 存在，前端过滤 Job 列表
4. 用户切换 EngineFilter → 更新 URL → 前端重新过滤（不重新请求 API）
```

---

## 8. 需要扩展的 API（只列需求，不实现）

### 8.1 GET /api/tasks/:taskId/graph

**当前状态**: ✅ 已实现基础功能

**扩展需求**:
1. **返回结构扩展**: 每个 Job 节点需要包含 `engineKey`, `engineVersion`, `adapterName`
2. **质量评分集成**: 返回 `qualityScores` 数组和 `qualityFeedback` 聚合结果

**扩展后的响应结构**:
```typescript
{
  success: true,
  data: {
    taskId: string;
    projectId: string;
    taskType: string;
    status: string;
    jobs: Array<{
      jobId: string;
      jobType: string;
      status: string;
      // 新增字段
      engineKey: string;
      engineVersion: string | null;
      adapterName: string;
      qualityScore: {
        score: number | null;
        confidence: number | null;
      } | null;
      metrics: {
        durationMs: number | null;
        costUsd: number | null;
      } | null;
    }>;
    // 新增字段
    qualityScores: QualityScoreRecord[];
    qualityFeedback: {
      avgScore: number | null;
      avgConfidence: number | null;
      total: number;
    };
  }
}
```

**实现位置**: 
- `TaskGraphService.findTaskGraph()` - 扩展返回结构
- `TaskGraphController` - 集成 `QualityScoreService` 和 `QualityFeedbackService`

**优先级**: P0（核心功能）

---

### 8.2 GET /api/orchestrator/monitor/stats

**当前状态**: ✅ 已实现基础功能

**扩展需求**:
1. **筛选参数**: 支持 `engineKey` 查询参数
2. **返回结构扩展**: 包含按 engine 分组的统计

**扩展后的请求参数**:
```typescript
{
  engineKey?: string;  // 新增：筛选 engineKey
}
```

**扩展后的响应结构**:
```typescript
{
  success: true,
  data: {
    jobs: {
      total: number;
      byStatus: Record<JobStatus, number>;
      // 新增字段
      byEngine?: Record<string, {
        total: number;
        byStatus: Record<JobStatus, number>;
        avgDurationMs: number | null;
        successRate: number;
      }>;
    };
    // ... 其他现有字段
  }
}
```

**实现位置**: 
- `OrchestratorService.getStats()` - 扩展筛选逻辑和返回结构

**优先级**: P1（监控功能）

---

### 8.3 GET /api/workers/monitor/stats

**当前状态**: ✅ 已实现基础功能

**扩展需求**:
1. **筛选参数**: 支持 `engineKey` 查询参数（可选）
2. **返回结构扩展**: 包含按 engine 分组的 Worker 负载统计（可选）

**扩展后的请求参数**:
```typescript
{
  engineKey?: string;  // 新增：筛选 engineKey（可选）
}
```

**扩展后的响应结构**:
```typescript
{
  success: true,
  data: {
    workers: WorkerMonitorSnapshot[];
    // 新增字段（可选）
    byEngine?: Record<string, {
      totalWorkers: number;
      activeWorkers: number;
      avgLoad: number;
    }>;
  }
}
```

**实现位置**: 
- `WorkerService.getWorkerMonitorSnapshot()` - 扩展筛选逻辑和返回结构

**优先级**: P2（可选功能）

---

### 8.4 GET /api/jobs

**当前状态**: ✅ 已实现基础功能（S3-C.1）

**扩展需求**:
1. **返回结构确认**: 确认已包含 `engineKey`, `engineVersion`, `adapterName`, `qualityScore`（S3-C.1 已实现）

**当前响应结构** (已满足需求):
```typescript
{
  success: true,
  data: {
    jobs: JobWithEngineInfo[];  // 已包含所需字段
    total: number;
    page: number;
    pageSize: number;
  }
}
```

**优先级**: P0（已实现，无需扩展）

---

### 8.5 GET /api/jobs/engine-summary

**当前状态**: ✅ 已实现（S3-C.2）

**扩展需求**: 无（已满足需求）

**优先级**: P0（已实现，无需扩展）

---

## 9. 实现优先级（分阶段说明）

### 9.1 Phase 1: 核心功能（P0）- 必须实现

**目标**: 确保核心页面的引擎信息展示完整且一致

**任务清单**:
1. ✅ **扩展 Task Graph API** (`GET /api/tasks/:taskId/graph`)
   - 返回 `engineKey`, `engineVersion`, `adapterName`
   - 集成 `qualityScores` 和 `qualityFeedback`
   - **预计时间**: 1-2 天

2. ✅ **统一数据提取逻辑**
   - 确认 `JobService.extractEngineKeyFromJob()` 在所有 API 中一致使用
   - 确认 `JobService.extractEngineVersionFromJob()` 在所有 API 中一致使用
   - **预计时间**: 0.5 天

3. ✅ **创建统一 UI 组件**
   - `EngineTag` - 引擎标签组件
   - `QualityScoreBadge` - 质量评分标签组件
   - `AdapterBadge` - 适配器标签组件
   - **预计时间**: 1-2 天

4. ✅ **优化现有页面**
   - `/studio/jobs` - 使用统一组件（已部分实现，需优化）
   - `/tasks/[taskId]/graph` - 使用统一组件（已部分实现，需优化）
   - `/projects/[projectId]/import-novel` - 使用统一组件（已部分实现，需优化）
   - **预计时间**: 1-2 天

**Phase 1 总计**: 3.5-6.5 天

---

### 9.2 Phase 2: 监控功能增强（P1）- 重要功能

**目标**: 增强监控页面的引擎维度统计

**任务清单**:
1. **扩展调度监控 API** (`GET /api/orchestrator/monitor/stats`)
   - 支持 `engineKey` 筛选参数
   - 返回按 engine 分组的统计
   - **预计时间**: 1-2 天

2. **优化监控页面**
   - `/monitor/scheduler` - 显示按 engine 分组的统计卡片
   - **预计时间**: 1 天

**Phase 2 总计**: 2-3 天

---

### 9.3 Phase 3: 可选功能（P2）- 可选实现

**目标**: 增强 Worker 监控页面的引擎维度展示

**任务清单**:
1. **扩展 Worker 监控 API** (`GET /api/workers/monitor/stats`)
   - 支持 `engineKey` 筛选参数（可选）
   - 返回按 engine 分组的 Worker 负载统计（可选）
   - **预计时间**: 1-2 天

2. **优化 Worker 监控页面**
   - `/monitor/workers` - 显示按 engine 分组的 Worker 负载（可选）
   - **预计时间**: 1 天

**Phase 3 总计**: 2-3 天

---

### 9.4 总体时间估算

| Phase | 优先级 | 预计时间 | 状态 |
|-------|--------|----------|------|
| Phase 1 | P0 | 3.5-6.5 天 | ⏳ 待执行 |
| Phase 2 | P1 | 2-3 天 | ⏳ 待执行 |
| Phase 3 | P2 | 2-3 天 | ⏳ 待执行 |
| **总计** | | **7.5-12.5 天** | |

---

## 10. 风险与注意事项

### 10.1 性能风险

#### 10.1.1 API 查询性能

**风险点**:
- `GET /api/tasks/:taskId/graph` 扩展后需要查询更多数据（qualityScores）
- `GET /api/orchestrator/monitor/stats` 按 engine 分组可能增加查询复杂度

**缓解措施**:
- 使用数据库索引优化查询（`engineKey`, `jobType`, `projectId`）
- 限制聚合查询的数据量（如最近 100 条 Job）
- 考虑引入 Redis 缓存热点数据（可选，不在 MVP 范围）

**监控指标**:
- API 响应时间 < 500ms（P95）
- 数据库查询时间 < 200ms（P95）

---

#### 10.1.2 前端渲染性能

**风险点**:
- Job 列表按 engine 分组可能影响渲染性能（大量 DOM 节点）
- Task Graph 节点标签增加可能影响可视化性能

**缓解措施**:
- 使用虚拟滚动（如果列表超过 500 行）
- 使用 React.memo 优化组件渲染
- 限制分组视图的数据量（约 500 行以内）

**监控指标**:
- 页面首次渲染时间 < 2s
- 交互响应时间 < 100ms

---

### 10.2 前后端一致性风险

#### 10.2.1 数据提取逻辑不一致

**风险点**:
- 不同 API 使用不同的 `engineKey` 提取逻辑，导致数据不一致

**缓解措施**:
- 统一使用 `JobService.extractEngineKeyFromJob()` 方法
- 统一使用 `JobService.extractEngineVersionFromJob()` 方法
- 编写单元测试确保提取逻辑一致

**检查清单**:
- [ ] 所有 API 使用统一的提取方法
- [ ] 单元测试覆盖所有提取场景
- [ ] 集成测试验证前后端数据一致性

---

#### 10.2.2 类型定义不一致

**风险点**:
- 前后端类型定义不一致，导致运行时错误

**缓解措施**:
- 使用 `shared-types` 包定义统一类型
- 前后端共享类型定义（如 `JobWithEngineInfo`, `EngineSummary`）
- TypeScript 严格模式检查

**检查清单**:
- [ ] 所有类型定义在 `shared-types` 中
- [ ] 前后端使用相同的类型定义
- [ ] TypeScript 编译无错误

---

### 10.3 S3-A / S3-B 封板约束

#### 10.3.1 禁止修改封板文件

**封板文件列表**:
- ❌ `apps/api/src/config/engine.config.ts` - 禁止修改
- ❌ `apps/api/src/engine/adapters/http-engine.adapter.ts` - 禁止修改（尤其是 HMAC / 鉴权 / 错误分类逻辑）

**约束说明**:
- 所有引擎信息必须从现有 API 或 Job payload 中提取
- 不能修改引擎配置读取逻辑
- 不能修改 HTTP 引擎适配器的核心逻辑

**检查清单**:
- [ ] 未修改任何封板文件
- [ ] 所有功能通过现有 API 实现
- [ ] 不影响现有引擎执行流程

---

#### 10.3.2 保持向后兼容

**风险点**:
- 新增字段可能影响现有前端页面

**缓解措施**:
- 所有新增字段使用可选类型（`?`）
- 现有字段保持原有格式和含义
- 提供默认值处理逻辑

**检查清单**:
- [ ] 所有新增字段为可选
- [ ] 现有页面功能不受影响
- [ ] 回归测试通过

---

### 10.4 数据一致性风险

#### 10.4.1 Job payload 数据缺失

**风险点**:
- 历史 Job 的 payload 中可能没有 `engineKey` 或 `engineVersion`
- 导致提取逻辑返回默认值或 null，数据不准确

**缓解措施**:
- 提取逻辑提供降级策略（使用默认引擎）
- 在 UI 中明确标识"未知引擎"或"默认引擎"
- 记录数据缺失的日志，便于后续修复

**处理策略**:
```typescript
// 提取 engineKey 的降级策略
const engineKey = extractEngineKeyFromJob(job) || 
                  getDefaultEngineKeyForJobType(job.type) || 
                  'default_novel_analysis';
```

---

#### 10.4.2 质量评分数据缺失

**风险点**:
- 部分 Job 的 payload 中可能没有 `qualityScore`
- 导致质量指标展示不完整

**缓解措施**:
- UI 中显示 `-` 或 `N/A` 表示无数据
- 聚合统计时排除 null 值
- 在 EngineSummaryPanel 中明确标注数据来源和统计范围

---

### 10.5 URL 参数管理风险

#### 10.5.1 参数冲突

**风险点**:
- 多个页面使用相同的 URL 参数名，可能产生冲突

**缓解措施**:
- 统一使用 `engineKey` 作为参数名
- 其他参数使用不同的名称（如 `projectId`, `jobType`）
- 使用 URLSearchParams 管理参数，避免手动拼接

---

#### 10.5.2 浏览器历史记录

**风险点**:
- URL 参数变化会产生大量浏览器历史记录
- 用户前进/后退可能产生意外的筛选状态

**缓解措施**:
- 使用 `router.push(url, { scroll: false })` 避免页面滚动
- 在 `useEffect` 中正确处理 URL 变化
- 提供"清除筛选"按钮，方便用户重置

---

### 10.6 用户体验风险

#### 10.6.1 筛选状态丢失

**风险点**:
- 用户刷新页面后，筛选状态可能丢失（如果未保存到 URL）

**缓解措施**:
- 所有筛选状态保存到 URL Query
- 页面加载时从 URL 恢复筛选状态
- 支持浏览器前进/后退

---

#### 10.6.2 数据加载延迟

**风险点**:
- 多个 API 并行请求可能导致页面加载慢
- 用户切换筛选时，数据加载可能产生闪烁

**缓解措施**:
- 使用 Suspense 和 loading 状态
- 实现数据预加载（可选）
- 使用骨架屏（Skeleton）提升用户体验

---

## 11. 总结

### 11.1 设计完成度

- ✅ **数据模型**: 统一的数据结构设计完成
- ✅ **API 规范**: 所有 API 扩展需求已明确
- ✅ **UI 组件**: 组件清单和接口定义完成
- ✅ **信息架构**: 所有页面的信息架构图完成
- ✅ **筛选机制**: URL 参数驱动的全局联动设计完成
- ✅ **展示规范**: 质量指标的颜色、数值、格式规范完成

### 11.2 下一步行动

1. **评审本文档**: 确认设计方向和技术方案
2. **进入执行阶段**: 按照 Phase 1 优先级开始实现
3. **分阶段实施**: 先完成 P0 功能，再逐步扩展 P1/P2 功能

### 11.3 关键约束回顾

- ❌ 禁止修改 S3-A / S3-B 封板文件
- ❌ 禁止改变调度逻辑和 Job 执行流程
- ✅ 所有修改必须是「只读展示」或「只读聚合 API」
- ✅ 保持向后兼容，不影响现有功能

---

**文档状态**: ✅ 设计完成，待评审  
**下一步**: 进入 MODE: EXECUTE 阶段，开始 Phase 1 实现

---

**维护者**: 开发团队  
**最后更新**: 2025-12-11

