# Stage3 规划文档

**生成时间**: 2024-12-11  
**规划模式**: PLAN-only（无代码修改）  
**前置条件**: Stage2 已完成并封板

---

## 1. Stage3 范围与目标

### 1.1 总体目标

在不破坏 Stage2 稳定基座的前提下，完成「引擎实战接入 + Engine 管理 + Studio 联动增强」的规划，形成可执行的批次计划。

### 1.2 三条主线

#### S3-A：HTTP 引擎真实接入（Engine Online）
- **目标**: 在现有 `HttpEngineAdapter` 基础上，规划如何挂接真实 LLM 服务（本地推理服务 / 云端 HTTP 模型）
- **约束**: 
  - 不能直接改现有 NOVEL_ANALYSIS 链路
  - 必须通过新增 JobType 或试验性 flag 来引入真实 HTTP 引擎
  - 保持 Stage2 调度核心不变

#### S3-B：Engine 管理 & 配置中心 MVP
- **目标**: 规划一套「Engine 配置管理」API + 简单的管理页面
- **功能范围**:
  - 列出 engineKey → Adapter / HTTP endpoint / Model 信息 / 默认与否
  - 支持按项目/租户配置默认引擎（先从全局配置开始）
- **约束**: 
  - 不引入复杂的计费/多租户策略
  - 先做单租户 + 全局配置 MVP
  - 不修改 schema.prisma（使用 JSON 配置存储）

#### S3-C：Studio / 导入页联动增强
- **目标**: 利用已有的 EngineTaskSummary / Task Graph / QualityScore 等能力，规划前端展示增强
- **功能范围**:
  - 导入页和 Studio 如何展示/筛选不同 engine 的任务和质量指标
  - Task Graph / Monitor 如何支撑"按 engine / jobType / 项目"维度查看调度 & 质量情况
- **约束**: 
  - 先以"只读展示 + 简单筛选"为主
  - 暂不做复杂交互（如在线重跑、多引擎对比实验）

### 1.3 不动边界（禁止修改）

#### 核心调度系统（S2-A）
- ❌ **禁止修改**: `apps/api/src/job/job.service.ts` 中的 `getAndMarkNextPendingJob` 方法
- ❌ **禁止修改**: `apps/api/src/orchestrator/orchestrator.service.ts` 中的调度核心逻辑
- ❌ **禁止修改**: Job 状态流转机制（PENDING → RUNNING → RETRYING/FAILED）
- ❌ **禁止修改**: Worker 离线恢复逻辑

#### 数据库 Schema
- ❌ **禁止修改**: `schema.prisma`（除非 Stage3 明确要求的新表，如 Engine 配置表）
- ❌ **禁止修改**: 现有 Task / ShotJob / WorkerNode 表结构

#### NOVEL_ANALYSIS 链路（S2-C）
- ❌ **禁止修改**: `apps/api/src/novel-import/novel-import.controller.ts` 的核心导入逻辑
- ❌ **禁止修改**: `apps/workers/src/novel-analysis-processor.ts` 的分析处理逻辑
- ❌ **禁止修改**: NOVEL_ANALYSIS 的默认引擎（仍使用 `default_novel_analysis` 本地适配器）

#### EngineAdapter 接口（S2-B）
- ❌ **禁止修改**: `packages/shared-types/src/engines/engine-adapter.ts` 中的 `EngineAdapter` 接口定义
- ❌ **禁止修改**: `EngineInvokeInput` 和 `EngineInvokeResult` 接口（除非扩展字段）

#### 监控与可视化核心（S2-D）
- ❌ **禁止修改**: `apps/api/src/orchestrator/orchestrator-monitor.controller.ts` 的返回结构
- ❌ **禁止修改**: `apps/api/src/task/task-graph.service.ts` 的核心聚合逻辑

---

## 2. 模块拆分与批次设计

### 2.1 S3-A：HTTP 引擎真实接入

#### S3-A.0：HTTP 引擎接入约束与策略（重要约束）

**核心约束**:
1. **禁止修改 NOVEL_ANALYSIS 现有执行链路**:
   - ❌ 禁止修改 `apps/api/src/novel-import/novel-import.controller.ts` 的核心导入逻辑
   - ❌ 禁止修改 `apps/workers/src/novel-analysis-processor.ts` 的分析处理逻辑
   - ❌ 禁止修改 NOVEL_ANALYSIS 的默认引擎绑定（仍使用 `default_novel_analysis` 本地适配器）

2. **HTTP 引擎接入仅允许通过以下两种方式**:
   - **方式 1**: 新增实验性 JobType（例如 `EXPERIMENTAL_NOVEL_ANALYSIS_HTTP`、`EXPERIMENTAL_SHOT_RENDER_HTTP`）
   - **方式 2**: 通过显式 feature flag（例如 `useHttpEngine: true`），且**默认关闭**

3. **Feature Flag 生效位置**:
   - Feature flag 在**创建 Job 时决定**（Task/Job payload 中设置）
   - **执行过程中不自动切换**引擎（Job 的 engineKey 已固化在 payload 中）
   - Feature flag 读取位置：
     - `EngineTaskService.extractEngineKey()` - 从 Task/Job payload 读取
     - `JobService.create()` - 创建 Job 时设置 payload.engineKey

4. **JobType 配置矩阵**:

| JobType | 默认 engineKey | 是否允许 HTTP | Feature Flag 名称 | 说明 |
|---------|---------------|--------------|------------------|------|
| `NOVEL_ANALYSIS` | `default_novel_analysis` | ❌ 禁止 | - | 现有链路，禁止修改 |
| `EXPERIMENTAL_NOVEL_ANALYSIS_HTTP` | `http_gemini_v1` | ✅ 允许 | - | 新增实验性 JobType |
| `SHOT_RENDER` | `default_shot_render` | ⚠️ 可选 | `useHttpEngine` | 可通过 flag 切换 |
| `EXPERIMENTAL_SHOT_RENDER_HTTP` | `http_gemini_v1` | ✅ 允许 | - | 新增实验性 JobType |

**Feature Flag 使用示例**:
```typescript
// 创建 Task 时设置 feature flag
const task = await taskService.createTask({
  type: 'SHOT_RENDER',
  payload: {
    useHttpEngine: true,  // 显式启用 HTTP 引擎
    engineKey: 'http_gemini_v1',  // 可选：显式指定 engineKey
    // ... 其他 payload
  }
});
```

#### S3-A.1：HTTP 引擎配置与安全设计（仅文档）

**目标**: 
- 设计 HTTP 引擎的环境变量配置方案
- 定义 HTTP 引擎的认证方式（API Key / Bearer Token / HMAC）
- 规划错误处理和限流策略
- 设计引擎配置的存储方式（环境变量 → 配置服务）

**允许修改的文件范围**（未来 EXECUTE）:
- `apps/api/src/config/engine.config.ts` - 扩展配置读取逻辑
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - 增强认证和错误处理
- `.env.example` - 新增 HTTP 引擎相关环境变量示例
- `docs/ENGINE_HTTP_CONFIG.md` - 新增配置文档

**与 Stage2 的依赖关系**:
- 依赖 `HttpEngineAdapter` 现有实现（S2-B）
- 依赖 `EngineConfigService` 配置读取机制
- 依赖 `HttpClient` 通用 HTTP 客户端

**设计要点**:
1. **环境变量配置**:
   - `HTTP_ENGINE_BASE_URL`: 基础 URL（如 `http://localhost:8000` 或 `https://api.openai.com`）
   - `HTTP_ENGINE_API_KEY`: API Key（可选，用于 Bearer Token 认证）
   - `HTTP_ENGINE_TIMEOUT_MS`: 超时时间（默认 30000ms）
   - `HTTP_ENGINE_RETRY_MAX`: 最大重试次数（默认 3，由 Job 重试机制控制）

2. **认证方式**:
   - Bearer Token: `Authorization: Bearer ${API_KEY}`
   - API Key Header: `X-API-Key: ${API_KEY}`（可选）
   - HMAC 签名（如果引擎服务支持，复用现有 HMAC 机制）

3. **错误处理策略**:
   - 网络错误（ECONNRESET, ETIMEDOUT）→ `RETRYABLE`
   - HTTP 4xx 错误 → `FAILED`（不重试）
   - HTTP 5xx 错误 → `RETRYABLE`（可重试）
   - 业务层错误（response.success=false）→ `FAILED`

4. **限流策略**:
   - 在 `HttpEngineAdapter` 层面不做限流（由外部服务控制）
   - 记录限流错误（HTTP 429）为 `RETRYABLE`，依赖 Job 重试机制

#### S3-A.2：HTTP 引擎调用路径设计（仅文档）

**目标**:
- 设计如何通过新增 JobType 或试验性 flag 引入真实 HTTP 引擎
- 规划 HTTP 引擎的请求/响应格式
- 设计引擎路由路径（如 `/invoke`, `/v1/chat/completions` 等）
- 规划模型信息（modelName, version）的传递方式

**允许修改的文件范围**（未来 EXECUTE）:
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - 实现请求构造和响应解析
- `packages/shared-types/src/engines/engine-adapter.ts` - 扩展 `EngineInvokeResult` 的 `metrics` 字段（如需要）
- `apps/api/src/config/engine.config.ts` - 支持多引擎配置（engineKey → config 映射）

**与 Stage2 的依赖关系**:
- 依赖 `EngineRegistry.findAdapter()` 的引擎选择逻辑
- 依赖 `EngineAdapter.invoke()` 接口规范
- 依赖 Job 重试机制处理 HTTP 引擎的临时错误

**设计要点**:
1. **新增 JobType 方案**:
   - 新增 `NOVEL_ANALYSIS_HTTP` JobType（试验性）
   - 或新增 `SHOT_RENDER_HTTP` JobType
   - 在 `EngineRegistry.getDefaultEngineKeyForJobType()` 中映射到 HTTP 引擎

2. **试验性 Flag 方案**:
   - 在 Task/Job payload 中添加 `useHttpEngine: true` flag
   - 在 `EngineTaskService.extractEngineKey()` 中优先读取此 flag
   - 如果 flag=true，强制使用 HTTP 引擎（如 `http_gemini_v1`）

3. **HTTP 请求格式**:
   ```typescript
   POST /invoke
   {
     "jobType": "NOVEL_ANALYSIS",
     "engineKey": "http_gemini_v1",
     "payload": { ... },
     "context": { projectId, sceneId, shotId, ... }
   }
   ```

4. **HTTP 响应格式**:
   ```typescript
   {
     "success": true,
     "status": "SUCCESS",
     "data": { ... },
     "metrics": {
       "durationMs": 1234,
       "tokens": 500,
       "costUsd": 0.01
     },
     "modelInfo": {
       "modelName": "gemini-pro",
       "version": "v1.0"
     }
   }
   ```

5. **引擎路由路径**:
   - 默认路径: `/invoke`（通用引擎接口）
   - OpenAI 兼容: `/v1/chat/completions`（如果使用 OpenAI 格式）
   - 自定义路径: 通过 `EngineConfigService` 配置 `path` 字段

### 2.2 S3-B：Engine 管理 & 配置中心 MVP

#### S3-B.1：Engine 管理 API 设计（仅文档）

**目标**:
- 设计 Engine 配置的 CRUD API（只读为主，简单写入）
- 设计 Engine 配置的数据模型（配置存储策略）
- 规划 Engine 配置的查询接口（列表、详情、按 engineKey 查询）

**配置存储策略 + MVP 范围**:

1. **单租户 + 简单配置原则**:
   - 本阶段只做单租户 + 全局配置，不做复杂多租户
   - 不支持按项目/租户的独立配置（后续扩展）

2. **配置存储方案决策**:
   
   **方案 A: 环境变量 + JSON 配置文件（推荐，MVP 阶段）**
   - ✅ 不修改 schema.prisma
   - ✅ 配置存储在 `config/engines.json` 或环境变量
   - ✅ 简单易维护，适合 MVP
   - ⚠️ 配置更新需要重启服务（或实现配置热加载）
   
   **方案 B: 新增数据库表（可选，需明确设计）**
   - ✅ 支持动态配置更新
   - ✅ 支持配置版本管理
   - ⚠️ 需要修改 schema.prisma，新增 `EngineConfig` 表
   - ⚠️ 需要实现配置缓存机制（避免频繁查询数据库）

   **决策**: Stage3 MVP 阶段采用**方案 A**（环境变量 + JSON 配置文件），后续可迁移到方案 B。

3. **EngineConfig 表结构草案**（如果采用方案 B）:
   ```prisma
   model EngineConfig {
     id                  String   @id @default(cuid())
     engineKey           String   @unique
     adapterType         String   // 'local' | 'http'
     adapterName         String
     httpBaseUrl         String?  // HTTP 引擎基础 URL
     httpPath            String?  // HTTP 引擎路径（默认 '/invoke'）
     httpAuthToken       String?  // HTTP 认证 Token（加密存储）
     httpTimeoutMs       Int?     // HTTP 超时时间（毫秒）
     modelName           String?  // 模型名称
     modelVersion        String?  // 模型版本
     isDefaultForJobTypes Json?   // 默认 JobType 映射，如 {"NOVEL_ANALYSIS": true}
     enabled             Boolean  @default(true)
     createdAt           DateTime @default(now())
     updatedAt           DateTime @updatedAt
     
     @@index([engineKey])
     @@index([enabled])
   }
   ```

**允许修改的文件范围**（未来 EXECUTE）:
- 新增 `apps/api/src/engine/engine-config.service.ts` - Engine 配置服务
- 新增 `apps/api/src/engine/engine-config.controller.ts` - Engine 配置 API
- 新增 `apps/api/src/engine/dto/engine-config.dto.ts` - DTO 定义
- 新增 `apps/api/src/engine/engine-config.module.ts` - 模块定义
- 新增 `config/engines.json` - 引擎配置文件（方案 A）
- 可选：修改 `schema.prisma` 新增 `EngineConfig` 表（方案 B）

**与 Stage2 的依赖关系**:
- 依赖 `EngineRegistry` 的适配器注册机制
- 依赖 `EngineConfigService` 的配置读取（S2-B）
- 依赖 `HttpEngineAdapter` 的配置结构

**设计要点**:
1. **数据模型**（JSON 存储，方案 A）:
   ```typescript
   interface EngineConfig {
     engineKey: string;
     adapterName: string;
     type: 'local' | 'http';
     httpConfig?: {
       baseUrl: string;
       path?: string;
       authToken?: string;
       timeoutMs?: number;
     };
     modelInfo?: {
       modelName?: string;
       version?: string;
     };
     isDefault?: boolean;
     enabled: boolean;
     createdAt: string;
     updatedAt: string;
   }
   ```

2. **API 接口**:
   - `GET /api/engines` - 列出所有引擎配置
   - `GET /api/engines/:engineKey` - 获取指定引擎配置
   - `GET /api/engines/default` - 获取默认引擎配置
   - `PUT /api/engines/:engineKey` - 更新引擎配置（仅限 enabled, isDefault 字段）
   - `POST /api/engines` - 创建新引擎配置（仅限 HTTP 引擎）

3. **存储方案**（MVP 阶段）:
   - 方案 A: 使用环境变量 + 配置文件（`config/engines.json`）
   - 方案 B: 使用数据库表 `engine_config`（需修改 schema.prisma）
   - 推荐: 方案 A（MVP 阶段），后续可迁移到方案 B

4. **默认引擎配置**:
   - 全局默认: 通过 `isDefault=true` 标记
   - 按 JobType 默认: 在 `EngineRegistry.getDefaultEngineKeyForJobType()` 中读取配置
   - 按项目默认: 后续扩展（不在 MVP 范围）

5. **EngineKey → Adapter/Endpoint/默认引擎配置矩阵示例**:

| engineKey | adapterName | adapterType | HTTP Endpoint | 默认 JobType | enabled | isDefault |
|-----------|-------------|-------------|---------------|--------------|---------|-----------|
| `default_novel_analysis` | `default_novel_analysis` | `local` | - | `NOVEL_ANALYSIS` | ✅ | ✅ |
| `default_shot_render` | `http` | `http` | `http://localhost:8000/invoke` | `SHOT_RENDER` | ✅ | ✅ |
| `http_gemini_v1` | `http` | `http` | `https://api.gemini.com/v1/invoke` | - | ✅ | ❌ |
| `http_openai_gpt4` | `http` | `http` | `https://api.openai.com/v1/chat/completions` | - | ✅ | ❌ |
| `http_local_llm` | `http` | `http` | `http://localhost:11434/api/generate` | - | ✅ | ❌ |

**配置示例**（`config/engines.json`）:
```json
{
  "engines": [
    {
      "engineKey": "default_novel_analysis",
      "adapterName": "default_novel_analysis",
      "adapterType": "local",
      "isDefaultForJobTypes": {
        "NOVEL_ANALYSIS": true
      },
      "enabled": true
    },
    {
      "engineKey": "http_gemini_v1",
      "adapterName": "http",
      "adapterType": "http",
      "httpConfig": {
        "baseUrl": "https://api.gemini.com",
        "path": "/v1/invoke",
        "timeoutMs": 30000
      },
      "modelInfo": {
        "modelName": "gemini-pro",
        "version": "v1.0"
      },
      "enabled": true
    }
  ]
}
```

#### S3-B.2：Engine 管理前端页面设计（仅文档）

**目标**:
- 设计 Engine 管理页面的信息架构
- 规划引擎列表、详情、编辑的 UI 流程
- 设计引擎配置的表单字段

**允许修改的文件范围**（未来 EXECUTE）:
- 新增 `apps/web/src/app/admin/engines/page.tsx` - Engine 管理页面
- 新增 `apps/web/src/app/admin/engines/[engineKey]/page.tsx` - Engine 详情页面
- 新增 `apps/web/src/components/engines/EngineList.tsx` - 引擎列表组件
- 新增 `apps/web/src/components/engines/EngineConfigForm.tsx` - 配置表单组件
- 修改 `apps/web/src/lib/apiClient.ts` - 新增 Engine API 客户端方法

**与 Stage2 的依赖关系**:
- 依赖 `EngineTaskService` 的引擎信息聚合
- 依赖 `QualityScoreService` 的质量指标（用于展示引擎性能）

**设计要点**:
1. **页面结构**:
   - 列表页: 显示所有引擎（engineKey, adapterName, type, enabled, isDefault）
   - 详情页: 显示引擎配置详情、最近使用统计、质量指标
   - 编辑页: 仅允许编辑 enabled / isDefault 字段（MVP 阶段）

2. **信息展示**:
   - 引擎基本信息: engineKey, adapterName, type
   - HTTP 配置: baseUrl, path, timeoutMs（仅显示，不可编辑）
   - 模型信息: modelName, version
   - 使用统计: 最近 24h 调用次数、成功率、平均耗时
   - 质量指标: avgScore, avgConfidence（从 QualityScoreService 聚合）

3. **交互限制**（MVP 阶段）:
   - 仅支持启用/禁用引擎（`enabled` 字段）
   - 仅支持设置/取消默认引擎（`isDefault` 字段）
   - 不支持创建/删除引擎（需通过配置文件或环境变量）

### 2.3 S3-C：Studio / 导入页联动增强

#### S3-C.1：Studio/导入页联动信息架构（仅文档）

**目标**:
- 设计如何在前端展示不同 engine 的任务和质量指标
- 规划 Task Graph / Monitor 的筛选维度（engine / jobType / 项目）
- 设计质量指标的展示方式（表格、图表、对比视图）

**路由与数据来源 API 对应关系**:

| 前端路由 | 数据来源 API | API 方法 | 说明 |
|---------|-------------|---------|------|
| `/monitor/workers` | `GET /api/workers/monitor/stats` | `WorkerService.getWorkerMonitorSnapshot()` | Worker 状态统计 |
| `/monitor/scheduler` | `GET /api/orchestrator/monitor/stats` | `OrchestratorService.getStats()` | 调度统计（Job 状态、重试分布、队列等待时间） |
| `/tasks/[taskId]/graph` | `GET /api/tasks/:taskId/graph` | `TaskGraphService.findTaskGraph()` + `QualityScoreService` + `QualityFeedbackService` | Task → Job 关系图 + 质量评分 |
| `/projects/[projectId]/import-novel` | `GET /api/tasks?projectId=xxx&taskType=NOVEL_ANALYSIS` | `EngineTaskService.findEngineTasksByProject()` | 导入历史任务列表（新增只读区块） |
| `/studio/jobs` | `GET /api/jobs?engineKey=xxx&jobType=xxx` | `JobService.findAll()`（需扩展筛选参数） | Job 列表（需新增 engine 筛选） |

**导入页增强设计**:
- **原有功能**: 保持现有导入逻辑不变（`POST /api/novels/import-file`、`POST /api/novels/import`）
- **新增只读区块**: 在导入页底部或侧边栏展示：
  - 调用 `GET /api/tasks?projectId={projectId}&taskType=NOVEL_ANALYSIS` 获取历史任务
  - 显示 `EngineTaskSummary` 摘要（engineKey, adapterName, status, jobs 数量）
  - 显示 `qualityFeedback` 聚合结果（avgScore, avgConfidence, total）
  - 显示最近 5 条导入记录的时间、引擎、质量指标

**允许修改的文件范围**（未来 EXECUTE）:
- 修改 `apps/web/src/app/studio/jobs/page.tsx` - 添加 engine 筛选和展示
- 修改 `apps/web/src/app/projects/[projectId]/import-novel/page.tsx` - 添加 engine 选择和质量预览（只读区块）
- 修改 `apps/web/src/app/tasks/[taskId]/graph/page.tsx` - 增强质量指标展示
- 修改 `apps/web/src/app/monitor/scheduler/page.tsx` - 添加按 engine 维度的统计
- 新增 `apps/web/src/components/quality/QualityMetrics.tsx` - 质量指标组件
- 修改 `apps/web/src/lib/apiClient.ts` - 新增筛选参数支持

**与 Stage2 的依赖关系**:
- 依赖 `EngineTaskService.findEngineTasksByProject()` 的引擎任务聚合
- 依赖 `TaskGraphController` 的 qualityScores 和 qualityFeedback 返回
- 依赖 `OrchestratorService.getStats()` 的调度统计

**UI 行为限制**（本阶段）:
- ✅ **允许**: 只读展示、简单筛选（按 engine / jobType / project）
- ✅ **允许**: 查看详情、查看质量指标
- ❌ **禁止**: 重跑 Job、取消 Job、切换引擎
- ❌ **禁止**: 在线编辑引擎配置
- ❌ **禁止**: 多引擎对比实验界面

**设计要点**:
1. **Studio Jobs 页面增强**:
   - 添加 engine 筛选器（下拉选择: 全部 / default_novel_analysis / http_gemini_v1 / ...）
   - 在 Job 列表中显示 engineKey 和 adapterName
   - 添加质量指标列（score, confidence，如果可用）
   - 支持按 engine 分组查看

2. **导入页增强**:
   - 添加 engine 选择器（默认使用 `default_novel_analysis`，可选 HTTP 引擎）
   - 显示历史导入的质量指标（avgScore, avgConfidence）
   - 显示不同 engine 的预估成本（如果 metrics.costUsd 可用）

3. **Task Graph 页面增强**:
   - 在 Task 信息中显示 engineKey 和 adapterName
   - 在 Job 列表中显示每个 Job 的质量指标（score, confidence）
   - 显示 qualityFeedback 聚合结果（avgScore, avgConfidence, total）
   - 支持按 engine 筛选 Job

4. **Monitor Scheduler 页面增强**:
   - 添加按 engine 维度的统计卡片（每个 engine 的 pending/running/failed 数量）
   - 添加按 engine 的重试分布图表
   - 添加按 engine 的平均等待时间对比

5. **筛选维度**:
   - 按 engineKey 筛选
   - 按 jobType 筛选（已有）
   - 按 projectId 筛选（已有）
   - 组合筛选（engine + jobType + project）

---

## 3. 不动边界 & 风险控制

### 3.1 禁止修改的核心模块

#### 调度系统核心（S2-A）
- **文件**: `apps/api/src/job/job.service.ts`
  - `getAndMarkNextPendingJob()` - Job 领取逻辑
  - `markJobFailedAndMaybeRetry()` - 失败重试逻辑
- **文件**: `apps/api/src/orchestrator/orchestrator.service.ts`
  - `recoverJobsFromOfflineWorkers()` - Worker 离线恢复
  - `processRetryJobs()` - 重试 Job 处理
- **风险**: 修改可能导致并发安全问题或状态流转错误

#### 数据库 Schema
- **文件**: `schema.prisma`
- **禁止修改的表**: Task, ShotJob, WorkerNode, Project, Season, Episode, Scene, Shot
- **例外**: 如果 S3-B 需要 Engine 配置表，可新增 `EngineConfig` 表（需明确设计）

#### NOVEL_ANALYSIS 链路
- **文件**: `apps/api/src/novel-import/novel-import.controller.ts`
- **文件**: `apps/workers/src/novel-analysis-processor.ts`
- **风险**: 修改可能影响现有分析流程的稳定性

#### EngineAdapter 接口
- **文件**: `packages/shared-types/src/engines/engine-adapter.ts`
- **风险**: 修改接口可能导致前后端类型不一致

### 3.2 风险点识别

#### S3-A 风险点

1. **HTTP 引擎超时/失败率影响**:
   - **风险**: HTTP 引擎的网络延迟和失败率可能高于本地适配器，导致 Job 重试次数增加
   - **缓解**: 
     - 设置合理的超时时间（默认 30s）
     - 区分可重试错误（网络错误）和不可重试错误（业务错误）
     - 监控 HTTP 引擎的失败率，设置告警阈值

2. **HTTP 引擎限流影响**:
   - **风险**: 外部服务限流（HTTP 429）可能导致大量 Job 进入重试队列
   - **缓解**:
     - 将 HTTP 429 标记为 `RETRYABLE`，依赖 Job 重试机制
     - 在 `HttpEngineAdapter` 中记录限流日志，便于监控
     - 考虑在 Adapter 层面实现简单的退避策略（可选，不在 MVP 范围）

3. **引擎配置安全**:
   - **风险**: API Key 等敏感信息存储在环境变量或配置文件中，可能泄露
   - **缓解**:
     - 使用环境变量存储敏感信息，不提交到代码仓库
     - 在配置文档中明确安全要求
     - 后续考虑使用密钥管理服务（不在 MVP 范围）

#### S3-B 风险点

1. **配置写入时的多环境差异**:
   - **风险**: 开发/测试/生产环境的引擎配置不同，配置更新可能影响其他环境
   - **缓解**:
     - MVP 阶段仅支持读取配置，写入通过配置文件手动操作
     - 明确标注配置的环境归属
     - 后续考虑配置版本管理和环境隔离

2. **默认引擎切换影响**:
   - **风险**: 切换默认引擎可能导致现有 Job 使用错误的引擎
   - **缓解**:
     - 默认引擎切换仅影响新创建的 Job
     - 已有 Job 的 engineKey 已固化在 payload 中，不受影响
     - 在切换前进行充分测试

#### S3-C 风险点

1. **前端性能影响**:
   - **风险**: 添加大量筛选和聚合查询可能影响前端性能
   - **缓解**:
     - 使用分页和懒加载
     - 在后端实现筛选和聚合，减少前端计算
     - 使用缓存机制（如 Redis）缓存统计结果

2. **数据一致性**:
   - **风险**: 前端展示的质量指标可能与实际数据不一致
   - **缓解**:
     - 所有质量指标从后端 API 获取，不依赖前端计算
     - 使用统一的类型定义（shared-types）
     - 定期验证数据一致性

### 3.3 新增风险类别

#### 外部 HTTP 引擎风险

1. **HttpEngineAdapter 重试策略约束**:
   - **风险**: HttpEngineAdapter 内部如果实现重试逻辑，可能与 Job 重试机制冲突
   - **约束**: 
     - HttpEngineAdapter 内部**只允许一次请求 + 错误分类（FAILED/RETRYABLE）**
     - **禁止**在 Adapter 内部实现重试循环、退避策略
     - 所有重试必须走 Job 重试系统（S2-A）
   - **实现要求**:
     - `HttpEngineAdapter.invoke()` 方法只发送一次 HTTP 请求
     - 根据错误类型返回 `EngineInvokeStatus.FAILED` 或 `EngineInvokeStatus.RETRYABLE`
     - Job 重试系统会根据 `RETRYABLE` 状态自动重试

2. **外部服务依赖风险**:
   - **风险**: HTTP 引擎服务不可用或响应慢，影响整体系统稳定性
   - **缓解**:
     - 设置合理的超时时间（默认 30s）
     - 监控外部服务的可用性和响应时间
     - 实现熔断机制（可选，不在 MVP 范围）

#### 性能风险

1. **监控 API 性能约束**:
   - **风险**: 监控 / TaskGraph / Quality / EngineTask 相关 API 如果实现复杂查询，可能影响性能
   - **约束**: 
     - Stage3 阶段**只做单请求聚合视图**，不做复杂分页/时间区间筛选
     - 所有聚合查询在单次请求中完成，不实现分页
     - 不实现时间区间筛选（如"最近 7 天"、"最近 30 天"）
   - **未来扩展**: 
     - 若未来需要分页，会在后续 Stage 专门设计
     - 若未来需要时间区间筛选，会引入时间序列数据库或缓存层

2. **数据量增长风险**:
   - **风险**: 随着 Job 数量增长，聚合查询可能变慢
   - **缓解**:
     - 使用数据库索引优化查询（如 `taskId`, `projectId`, `engineKey`）
     - 考虑引入 Redis 缓存热点数据（可选，不在 MVP 范围）
     - 监控 API 响应时间，设置告警阈值

---

## 4. 执行顺序建议

### 4.1 推荐执行顺序

#### 第一阶段：S3-A HTTP 引擎接入设计

**目标**: 完成 HTTP 引擎配置与调用的详细设计，确保 HTTP 引擎能够安全、可靠地接入系统。

1. **S3-A.1**: HTTP 引擎配置与安全设计（文档）
   - 输出: `docs/ENGINE_HTTP_CONFIG.md`
   - 时间: 1-2 天
   - **内容要求**:
     - 环境变量配置方案（变量名、默认值、验证规则）
     - 认证方式设计（Bearer Token / API Key / HMAC）
     - 错误处理策略（网络错误、HTTP 错误、业务错误）
     - 限流策略（HTTP 429 处理）
     - 安全要求（API Key 存储、传输加密）

2. **S3-A.2**: HTTP 引擎调用路径设计（文档）
   - 输出: `docs/ENGINE_HTTP_INVOKE.md`
   - 时间: 1-2 天
   - **内容要求**:
     - HTTP 请求/响应格式规范
     - 引擎路由路径设计（`/invoke`、`/v1/chat/completions` 等）
     - 模型信息传递方式（modelName, version）
     - **调用时序图**（文字说明）:
       ```
       1. Worker 拉取 Job (getAndMarkNextPendingJob)
       2. Worker 调用 EngineRegistry.findAdapter(engineKey, jobType)
       3. EngineRegistry 返回 HttpEngineAdapter
       4. Worker 调用 HttpEngineAdapter.invoke(input)
       5. HttpEngineAdapter 构造 HTTP 请求（读取配置、添加认证）
       6. 发送 HTTP 请求到外部引擎服务
       7. 接收 HTTP 响应
       8. HttpEngineAdapter 解析响应，返回 EngineInvokeResult
       9. Worker 根据结果更新 Job 状态（SUCCESS → SUCCEEDED, RETRYABLE → RETRYING, FAILED → FAILED）
       10. 如果 RETRYABLE，Job 重试系统会在下次调度时重新处理
       ```
     - Feature Flag 生效机制（创建 Job 时决定，执行中不切换）

**理由**: HTTP 引擎接入是后续 Engine 管理和前端展示的基础，需要先完成设计。

#### 第二阶段：S3-B Engine 管理设计

**目标**: 基于已确定的配置模型（环境变量 + JSON 配置文件），设计 Engine 管理 API + 前端页面。

3. **S3-B.1**: Engine 管理 API 设计（文档）
   - 输出: `docs/ENGINE_MANAGEMENT_API.md`
   - 时间: 2-3 天
   - **内容要求**:
     - API 接口设计（GET /api/engines, GET /api/engines/:engineKey, PUT /api/engines/:engineKey）
     - 配置存储方案实现细节（JSON 文件读取、环境变量覆盖）
     - DTO 定义（EngineConfigDto, UpdateEngineConfigDto）
     - 权限控制（仅管理员可修改配置）
     - 配置验证规则（engineKey 唯一性、HTTP 配置完整性）

4. **S3-B.2**: Engine 管理前端页面设计（文档）
   - 输出: `docs/ENGINE_MANAGEMENT_UI.md`
   - 时间: 1-2 天
   - **内容要求**:
     - 页面信息架构（列表页、详情页、编辑页）
     - UI 组件设计（EngineList, EngineConfigForm）
     - 交互流程（查看配置、启用/禁用引擎、设置默认引擎）
     - 数据展示（引擎基本信息、HTTP 配置、使用统计、质量指标）

**理由**: Engine 管理提供了引擎配置的统一入口，便于后续前端展示引擎信息。

#### 第三阶段：S3-C Studio/导入页联动设计

**目标**: 完成监控 / TaskGraph / Quality 与 Studio/导入页的数据流信息架构设计。

5. **S3-C.1**: Studio/导入页联动信息架构（文档）
   - 输出: `docs/STUDIO_ENGINE_INTEGRATION.md`
   - 时间: 2-3 天
   - **内容要求**:
     - **数据流信息架构图**（文字说明 + 列表）:
       ```
       前端页面 → API 调用 → 后端服务 → 数据聚合 → 返回结果
       
       /monitor/workers
         → GET /api/workers/monitor/stats
         → WorkerService.getWorkerMonitorSnapshot()
         → 聚合 WorkerNode 表数据
         → 返回 WorkerMonitorSnapshot
       
       /monitor/scheduler
         → GET /api/orchestrator/monitor/stats
         → OrchestratorService.getStats()
         → 聚合 ShotJob 表数据（按 status、engineKey 分组）
         → 返回调度统计（jobs, workers, retries, queue, recovery）
       
       /tasks/[taskId]/graph
         → GET /api/tasks/:taskId/graph
         → TaskGraphService.findTaskGraph(taskId)
         → 查询 Task + Jobs
         → QualityScoreService.buildQualityScoreFromJob() (循环)
         → QualityFeedbackService.evaluateQualityScores()
         → 返回 TaskGraph + qualityScores + qualityFeedback
       
       /projects/[projectId]/import-novel
         → GET /api/tasks?projectId=xxx&taskType=NOVEL_ANALYSIS
         → EngineTaskService.findEngineTasksByProject(projectId, 'NOVEL_ANALYSIS')
         → 查询 Task + Jobs（过滤 NOVEL_ANALYSIS）
         → 提取 engineKey, adapterName
         → 返回 EngineTaskSummary[]
         → 前端调用 QualityScoreService 聚合质量指标（可选）
       ```
     - 筛选维度设计（engine / jobType / project 的组合筛选）
     - 质量指标展示方式（表格、卡片、简单图表）
     - UI 组件设计（QualityMetrics, EngineFilter, TaskList）

**理由**: 前端联动增强依赖前两阶段的设计，需要明确数据来源和展示方式。

### 4.4 执行前置条件

**重要**: 只有当 `STAGE3_PLAN.md` 完成本次修订并通过人工 Review，才允许进入任何 S3-x.y 批次的 `MODE: EXECUTE`。

**Review 检查清单**:
- [ ] S3-A 约束与策略已明确（禁止修改 NOVEL_ANALYSIS，HTTP 引擎接入方式）
- [ ] S3-B 配置存储策略已确定（环境变量 + JSON 或数据库表）
- [ ] S3-C 路由与 API 对应关系已列出
- [ ] 风险控制章节已补充（外部 HTTP 引擎风险、性能风险）
- [ ] 执行顺序已具体化（包含时序图和数据流说明）

### 4.2 执行模式说明

**当前阶段**: PLAN-only（规划阶段）
- ✅ 已完成: Stage3 规划文档（本文档）
- ⏳ 待执行: 各批次的详细设计文档
- 🚫 禁止: 修改任何代码文件

**后续阶段**: MODE: EXECUTE（执行阶段）
- 每个批次完成后，进入 `MODE: EXECUTE` 执行代码实现
- 执行前需确认设计文档已通过评审
- 执行后需进行回归测试，确保 Stage2 功能不受影响

### 4.3 依赖关系图

```
S3-A.1 (HTTP 配置设计)
  ↓
S3-A.2 (HTTP 调用路径设计)
  ↓
S3-B.1 (Engine 管理 API 设计) ← 依赖 S3-A.1/A.2
  ↓
S3-B.2 (Engine 管理前端设计) ← 依赖 S3-B.1
  ↓
S3-C.1 (Studio 联动设计) ← 依赖 S3-A.1/A.2, S3-B.1/B.2
```

---

## 5. 总结

### 5.1 规划完成度

- ✅ **S3-A**: HTTP 引擎真实接入的设计框架已明确
- ✅ **S3-B**: Engine 管理 & 配置中心 MVP 的设计方向已确定
- ✅ **S3-C**: Studio / 导入页联动增强的信息架构已规划

### 5.2 关键约束

1. **不动边界**: 严格禁止修改 Stage2 核心调度系统、数据库 Schema、NOVEL_ANALYSIS 链路
2. **MVP 原则**: 先做单租户 + 全局配置，暂不做复杂多租户和计费
3. **只读优先**: 前端联动以"只读展示 + 简单筛选"为主，暂不做复杂交互

### 5.3 下一步行动

1. **评审本文档**: 确认规划方向和技术方案
2. **分批设计**: 按照执行顺序，逐个批次完成详细设计文档
3. **进入执行**: 设计文档通过后，分批进入 `MODE: EXECUTE` 实现代码

---

**文档状态**: ✅ 规划完成，待评审  
**后续文档**: 各批次的详细设计文档将在执行前生成

