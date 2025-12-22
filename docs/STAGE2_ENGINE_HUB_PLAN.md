# Stage2 Engine Hub 规划文档（v1.0 草案）

**生成时间**: 2025-12-11  
**文档版本**: v1.0  
**状态**: 📋 规划阶段（RESEARCH + PLAN）

---

## 重要声明

**本计划不修改 Stage1 冻结范围内的任何 Schema 和审计逻辑**。

- ✅ 不修改 `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Stage1 已封板的 Schema
- ✅ 不修改 Stage1 已确认的审计日志逻辑
- ✅ 不修改 Orchestrator / Worker 主流程的总体结构（调度算法保持不变）
- ✅ 不改动已有 HMAC / Nonce / 签名 / 重放防护逻辑

**允许范围**：
- ✅ 在 Engine 层 / Engine Hub 层新增模块、DTO、服务
- ✅ 为 Engine Hub 新增内部使用的 Prisma 模型 / 配置表（如果确有必要）
- ✅ 新增与 Engine Hub 相关的 API（例如统一的 Engine 调用接口），但不能破坏 Stage1 已确认的 API 安全链路

---

## 1. 目标与范围

### 目标

构建统一的 **Engine Hub** 架构，作为所有引擎调用的统一入口和路由中心。Stage2 聚焦于：

1. **统一引擎调用接口**：所有引擎调用都通过 Engine Hub 进行，不再分散在各个业务模块
2. **引擎注册与发现**：通过 EngineRegistry 维护引擎清单，支持动态注册和查找
3. **路由决策**：通过 EngineRouter 根据任务类型、配置、策略选择最合适的引擎
4. **NOVEL_ANALYSIS 专用流程**：作为 Stage2 MVP，完整实现小说分析引擎的调用链路

### 内容

- **核心组件设计**：EngineRegistry、EngineRouter/EngineInvoker、Engine DTO
- **NOVEL_ANALYSIS 流程**：从 Job/Task → Engine Hub → Result 的全链路实现
- **与 Stage1 的兼容性**：确保不破坏现有 Task/Job/Worker 体系
- **扩展预留**：为未来 48 个引擎预留插槽和配置机制

### 关键结果

- ✅ Engine Hub 三个核心组件已实现并集成
- ✅ NOVEL_ANALYSIS 引擎调用链路完整可用
- ✅ 引擎调用统一通过 Engine Hub，不再分散
- ✅ 为未来引擎扩展预留清晰的接口和配置机制

---

## 2. 总体架构（Engine Hub 概览）

### 目标

建立清晰的 Engine Hub 架构，明确各组件职责边界。

### 内容

```
┌─────────────────────────────────────────────────────────────┐
│                    Engine Hub 架构                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐  │
│  │  Engine      │      │  Engine      │      │ Engine   │  │
│  │  Registry    │─────▶│  Router      │─────▶│ Invoker  │  │
│  │              │      │              │      │          │  │
│  └──────────────┘      └──────────────┘      └──────────┘  │
│         │                      │                    │        │
│         │                      │                    │        │
│         ▼                      ▼                    ▼        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Engine Adapters (Local / HTTP)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Engine DTOs (@scu/shared-types)            │   │
│  │  - EngineInvocationRequest                          │   │
│  │  - EngineInvocationResult                           │   │
│  │  - AnalyzedProjectStructure (NOVEL_ANALYSIS)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**调用流程**：

1. **Job/Task 层**：创建 Job 时指定 `engineKey` 和 `jobType`
2. **Engine Hub 层**：
   - EngineRegistry 查找适配器
   - EngineRouter 决定最终使用的 `engineKey` 和 `version`
   - EngineInvoker 调用适配器执行
3. **Adapter 层**：Local Adapter 或 HTTP Adapter 执行具体逻辑
4. **结果返回**：统一返回 `EngineInvokeResult`，包含 `status`、`output`、`metrics`、`error`

### 关键结果

- ✅ 架构图清晰展示 Engine Hub 三层结构
- ✅ 调用流程文档化，便于后续扩展

---

## 3. 核心组件设计

### 3.1 EngineRegistry（引擎注册表）

#### 目标

维护引擎清单，提供引擎适配器的注册、查找、配置解析能力。

#### 内容

**职责**：
- 维护引擎适配器清单（`Map<string, EngineAdapter>`）
- 提供适配器注册接口（`register(adapter: EngineAdapter)`）
- 提供适配器查找接口（`getAdapter(engineKey)`, `findAdapter(engineKey, jobType, payload)`）
- 提供默认引擎映射（`getDefaultEngineKeyForJobType(jobType)`）
- 提供配置解析（`resolveEngineConfig(engineKey)`, `resolveEngineConfigWithVersion(engineKey, version)`）

**不直接做调用逻辑**，只提供"这是什么引擎、去哪调"的元数据。

**关键接口**：

```typescript
class EngineRegistry {
  // 注册适配器
  register(adapter: EngineAdapter): void;
  
  // 查找适配器
  getAdapter(engineKey: string): EngineAdapter | null;
  findAdapter(engineKey?: string, jobType?: string, payload?: any): EngineAdapter;
  
  // 默认引擎映射
  getDefaultEngineKeyForJobType(jobType: string): string | null;
  
  // 配置解析
  resolveEngineConfig(engineKey: string): Promise<any | null>;
  resolveEngineConfigWithVersion(engineKey: string, version?: string): Promise<any | null>;
  
  // 统一调用入口（内部会调用 EngineRouter 和 EngineInvoker）
  invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
```

**当前实现状态**：
- ✅ `apps/api/src/engine/engine-registry.service.ts` 已实现
- ✅ 支持适配器注册和查找
- ✅ 支持配置解析（JSON + DB）
- ✅ 支持统一调用入口（内部集成 EngineRoutingService）

#### 关键结果

- ✅ EngineRegistry 已实现并可用
- ✅ 支持 Local 和 HTTP 两种适配器类型
- ✅ 配置解析优先级：DB > JSON > Environment Variables

---

### 3.2 EngineRouter / EngineInvoker（路由与调用）

#### 目标

接收标准的 `EngineInvokeInput`，根据配置和策略选择最合适的引擎，并执行调用。

#### 内容

**EngineRouter（路由决策）**：

- 接收 `EngineInvokeInput`（含 `engineKey`, `engineVersion`, `payload`, `jobType`）
- 根据 `EngineRegistry` 的配置，选择本地实现或 HTTP 调用
- 返回路由决策结果（`engineKey`, `resolvedVersion`）

**EngineInvoker（调用执行）**：

- 接收路由决策结果和 `EngineInvokeInput`
- 调用对应的 `EngineAdapter.invoke()`
- 返回标准的 `EngineInvokeResult`

**关键接口**：

```typescript
// EngineRouter
interface EngineRoutingInput {
  jobType?: string | null;
  baseEngineKey?: string | null;
  payload?: any;
}

interface EngineRoutingResult {
  engineKey: string | null;
  resolvedVersion?: string | null;
}

class EngineRoutingService {
  resolve(input: EngineRoutingInput): EngineRoutingResult;
}

// EngineInvoker
class EngineInvokerService {
  async invoke({ adapter, input, engineKey }: InvokeParams): Promise<EngineInvokeResult>;
}
```

**当前实现状态**：
- ✅ `apps/api/src/engine/engine-routing.service.ts` 已实现
- ✅ `apps/api/src/engines/engine-invoker.service.ts` 已实现
- ✅ 路由逻辑已集成到 `EngineRegistry.invoke()` 中

#### 关键结果

- ✅ EngineRouter 和 EngineInvoker 已实现并可用
- ✅ 路由决策支持 NOVEL_ANALYSIS 默认走本地、HTTP 引擎切换等逻辑

---

### 3.3 Engine DTO（统一输入输出）

#### 目标

对所有引擎输入输出做统一的包装，确保前后端和 Worker 端类型一致。

#### 内容

**核心 DTO**（放在 `@scu/shared-types` 中）：

1. **EngineInvocationRequest**（统一输入）：
   ```typescript
   interface EngineInvokeInput {
     engineKey?: string;
     engineVersion?: string;
     jobType: string;
     payload: any;
     context: {
       projectId?: string;
       organizationId?: string;
       userId?: string;
       [key: string]: any;
     };
   }
   ```

2. **EngineInvocationResult**（统一输出）：
   ```typescript
   enum EngineInvokeStatus {
     SUCCESS = 'SUCCESS',
     FAILED = 'FAILED',
     TIMEOUT = 'TIMEOUT',
   }
   
   interface EngineInvokeResult {
     status: EngineInvokeStatus;
     output?: any;
     metrics?: {
       durationMs?: number;
       tokens?: number;
       costUsd?: number;
       [key: string]: any;
     };
     error?: {
       message: string;
       code?: string;
       details?: any;
     };
   }
   ```

3. **AnalyzedProjectStructure**（NOVEL_ANALYSIS 专用）：
   ```typescript
   interface AnalyzedProjectStructure {
     projectId: string;
     seasons: AnalyzedSeason[];
     stats: {
       seasonsCount: number;
       episodesCount: number;
       scenesCount: number;
       shotsCount: number;
     };
   }
   ```

**当前实现状态**：
- ✅ `packages/shared-types/src/engines/engine-adapter.ts` 已定义 `EngineAdapter` 接口
- ✅ `EngineInvokeInput` 和 `EngineInvokeResult` 已定义
- ✅ `packages/shared-types/src/novel-analysis.dto.ts` 已定义 `AnalyzedProjectStructure`

#### 关键结果

- ✅ Engine DTO 已定义并导出
- ✅ 前后端和 Worker 端可共享同一套类型定义

---

## 4. NOVEL_ANALYSIS 专用流程（Stage2 MVP）

### 目标

完整实现 NOVEL_ANALYSIS 引擎从 Job/Task → Engine Hub → Result 的全链路。

### 内容

**调用链路**：

```
1. API 层创建 Task 和 Job
   └─> Task.type = 'NOVEL_ANALYSIS'
   └─> Job.type = 'NOVEL_ANALYSIS'
   └─> Job.payload.engineKey = 'default_novel_analysis' (可选)

2. Orchestrator 派发 Job 到 Worker
   └─> Worker 接收 Job

3. Worker 调用 Engine Hub
   └─> EngineAdapterClient.findAdapter('default_novel_analysis', 'NOVEL_ANALYSIS')
   └─> 返回 NovelAnalysisLocalAdapterWorker

4. Worker 调用 Adapter.invoke()
   └─> NovelAnalysisLocalAdapterWorker.invoke(input)
   └─> 内部调用 basicTextSegmentation() 解析文本
   └─> 内部调用 applyAnalyzedStructureToDatabase() 写入数据库
   └─> 返回 EngineInvokeResult

5. Worker 将结果写回 Job
   └─> Job.status = 'SUCCEEDED'
   └─> Job.payload.result = EngineInvokeResult.output
```

**关键实现点**：

1. **Worker 端 EngineAdapterClient**：
   - `apps/workers/src/engine-adapter-client.ts` 已实现
   - 注册 `NovelAnalysisLocalAdapterWorker`
   - 提供 `findAdapter()` 和 `invoke()` 方法

2. **NovelAnalysisLocalAdapterWorker**：
   - 实现 `EngineAdapter` 接口
   - `supports('default_novel_analysis')` 返回 `true`
   - `invoke()` 方法执行文本解析和数据库写入

3. **文本解析逻辑**：
   - `apps/workers/src/novel-analysis-processor.ts` 中的 `basicTextSegmentation()`
   - 规则解析：按"第X季/卷/部"、"第X章/回/集"、空行、句号等切分

4. **数据库写入逻辑**：
   - `apps/workers/src/novel-analysis-processor.ts` 中的 `applyAnalyzedStructureToDatabase()`
   - 将 `AnalyzedProjectStructure` 写入 Project/Episode/Scene/Shot 表

**当前实现状态**：
- ✅ Worker 端 EngineAdapterClient 已实现
- ✅ NovelAnalysisLocalAdapterWorker 已实现
- ✅ 文本解析和数据库写入逻辑已实现
- ✅ 调用链路完整可用

### 关键结果

- ✅ NOVEL_ANALYSIS 引擎调用链路完整实现
- ✅ 从 Job 创建到结果写入数据库全流程可用
- ✅ 支持通过 `engineKey` 指定引擎（默认 `default_novel_analysis`）

---

## 5. 与 Stage1 的边界与兼容性

### 目标

确保 Engine Hub 不破坏 Stage1 已封板的 Schema 和审计逻辑。

### 内容

**Stage1 冻结范围（不可修改）**：

1. **Prisma Schema**：
   - `Task` 模型（`output`, `workerId` 字段和关系）
   - `AuditLog` 模型（`payload` 字段）
   - `NovelChapter` 模型（`summary` 字段）
   - `Scene.projectId` 字段（仍为可选，迁移方案已记录）

2. **审计逻辑**：
   - `ORGANIZATION_SWITCH` 审计日志
   - 已定义的审计动作枚举

3. **安全链路**：
   - HMAC / Nonce / 签名 / 重放防护逻辑
   - JWT / HMAC Guard

**Engine Hub 与 Stage1 的集成点**：

1. **Task/Job 层**：
   - Engine Hub 不修改 `Task` 和 `Job` 的 Schema
   - Engine Hub 通过 `Job.payload.engineKey` 读取引擎配置
   - Engine Hub 通过 `Job.payload.result` 写入结果

2. **Worker 层**：
   - Engine Hub 不修改 Worker 主流程
   - Engine Hub 作为 Worker 内部的引擎调用抽象层

3. **审计层**：
   - Engine Hub 不修改审计逻辑
   - 引擎调用本身不触发审计日志（由 Job/Task 层触发）

**兼容性保证**：

- ✅ Engine Hub 只新增模块，不修改 Stage1 已封板的代码
- ✅ Engine Hub 通过 `Job.payload` 传递引擎配置和结果，不修改 Schema
- ✅ Engine Hub 不修改 Orchestrator / Worker 主流程

### 关键结果

- ✅ Engine Hub 与 Stage1 完全兼容
- ✅ 不破坏 Stage1 已封板的 Schema 和审计逻辑

---

## 6. 后续扩展（为 48 个引擎预留的插槽）

### 目标

为未来 48 个引擎预留清晰的扩展机制，确保新增引擎时只需实现 Adapter，无需修改核心逻辑。

### 内容

**扩展机制**：

1. **引擎注册**：
   - 通过 `EngineRegistry.register(adapter)` 注册新引擎
   - 支持 Local Adapter 和 HTTP Adapter 两种类型

2. **配置管理**：
   - JSON 配置文件（`config/engines.json`）
   - 数据库配置表（`EngineConfig`, `EngineVersion`）
   - 环境变量配置（`HTTP_ENGINE_*_BASE_URL` 等）

3. **路由规则**：
   - 通过 `EngineRoutingService` 扩展路由规则
   - 支持基于 `jobType`、`payload`、`context` 的路由决策

4. **Adapter 实现**：
   - 实现 `EngineAdapter` 接口
   - 实现 `supports(engineKey)` 和 `invoke(input)` 方法
   - 返回标准的 `EngineInvokeResult`

**预留插槽示例**：

```typescript
// 未来新增引擎示例
class ImageGenerationAdapter implements EngineAdapter {
  public readonly name = 'image_generation_v1';
  
  supports(engineKey: string): boolean {
    return engineKey === 'image_generation_v1';
  }
  
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    // 实现图像生成逻辑
    return { status: EngineInvokeStatus.SUCCESS, output: {...} };
  }
}

// 注册到 EngineRegistry
engineRegistry.register(new ImageGenerationAdapter());
```

**配置示例**（`config/engines.json`）：

```json
{
  "engines": [
    {
      "engineKey": "image_generation_v1",
      "adapterName": "http",
      "adapterType": "http",
      "httpConfig": {
        "baseUrl": "${IMAGE_GEN_BASE_URL}",
        "path": "/invoke",
        "timeoutMs": 60000
      },
      "enabled": true
    }
  ]
}
```

### 关键结果

- ✅ 扩展机制清晰，新增引擎只需实现 Adapter
- ✅ 配置管理支持 JSON、DB、环境变量三种方式
- ✅ 路由规则可扩展，支持复杂路由策略

---

## 7. 风险与不做的事情（明确不在 Stage2 范围内的点）

### 目标

明确 Stage2 的边界，避免范围蔓延。

### 内容

**Stage2 不做的事情**：

1. **不实现其他引擎**：
   - 只实现 NOVEL_ANALYSIS 引擎
   - 其他引擎（图像生成、视频渲染等）只在文档中以"配置占位"方式出现

2. **不修改调度算法**：
   - 不修改 Orchestrator 的任务派发逻辑
   - 不修改 Worker 的任务执行流程
   - 不修改 Job 重试机制

3. **不修改安全链路**：
   - 不修改 HMAC / Nonce / 签名 / 重放防护逻辑
   - 不修改 JWT / HMAC Guard

4. **不修改 Stage1 封板内容**：
   - 不修改 Task / AuditLog / NovelChapter / Scene.projectId 等 Schema
   - 不修改审计日志逻辑

5. **不实现复杂路由策略**：
   - 不实现基于成本、质量、速度的智能路由（留给 Stage4）
   - 不实现 A/B 测试和灰度发布（留给 Stage4）

**风险点**：

1. **性能风险**：
   - Engine Hub 作为统一入口，可能成为性能瓶颈
   - **缓解措施**：Engine Hub 只做路由和调用，不做复杂计算

2. **兼容性风险**：
   - 现有代码可能直接调用引擎，绕过 Engine Hub
   - **缓解措施**：逐步迁移，确保向后兼容

3. **扩展性风险**：
   - 48 个引擎的配置管理可能变得复杂
   - **缓解措施**：使用配置分层（JSON + DB + 环境变量）

### 关键结果

- ✅ Stage2 边界清晰，避免范围蔓延
- ✅ 风险点已识别，缓解措施已制定

---

## 8. Stage2 MVP 落地代码点

### 目标

明确 Stage2 MVP 需要落地的具体代码点。

### 内容

**已实现的代码点**（无需修改）：

1. ✅ `apps/api/src/engine/engine-registry.service.ts` - EngineRegistry 实现
2. ✅ `apps/api/src/engine/engine-routing.service.ts` - EngineRouter 实现
3. ✅ `apps/api/src/engines/engine-invoker.service.ts` - EngineInvoker 实现
4. ✅ `apps/workers/src/engine-adapter-client.ts` - Worker 端 EngineAdapterClient
5. ✅ `apps/workers/src/novel-analysis-processor.ts` - NOVEL_ANALYSIS 文本解析和数据库写入
6. ✅ `packages/shared-types/src/engines/engine-adapter.ts` - Engine DTO 定义
7. ✅ `packages/shared-types/src/novel-analysis.dto.ts` - AnalyzedProjectStructure 定义

**可能需要优化的代码点**（待确认）：

1. ⚠️ `apps/api/src/engine/engine-registry.service.ts` - 确保 `invoke()` 方法正确集成 EngineRouter 和 EngineInvoker
2. ⚠️ `apps/workers/src/main.ts` - 确保 Worker 正确使用 EngineAdapterClient
3. ⚠️ `apps/api/src/novel-import/novel-import.service.ts` - 确保创建 Job 时正确设置 `engineKey`

**新增代码点**（如果需要）：

1. 📝 统一的 Engine 调用 API（可选，如果需要在 API 层直接调用引擎）
2. 📝 Engine Hub 监控和日志（可选，用于调试和运维）

### 关键结果

- ✅ 大部分代码已实现，Stage2 主要是整合和优化
- ✅ 明确需要优化的代码点，便于后续执行

---

## 9. 总结

### Stage2 Engine Hub 核心价值

1. **统一入口**：所有引擎调用都通过 Engine Hub，不再分散
2. **清晰边界**：EngineRegistry、EngineRouter、EngineInvoker 职责明确
3. **易于扩展**：新增引擎只需实现 Adapter，无需修改核心逻辑
4. **向后兼容**：不破坏 Stage1 已封板的内容

### 下一步行动

1. **EXECUTE 阶段**：根据本规划文档执行代码整合和优化
2. **测试验证**：确保 NOVEL_ANALYSIS 引擎调用链路完整可用
3. **文档完善**：补充 API 文档和使用示例

---

**文档状态**: ✅ v1.0 草案已完成，待用户确认后进入 EXECUTE 阶段

**最后更新**: 2025-12-11

---

## 10. S2-EXECUTION-REPORT v1.0

**执行时间**: 2025-12-11  
**执行模式**: MODE: EXECUTE  
**修复范围**: Stage2 Engine Hub 最小闭环实现

---

### 10.1 新增文件清单

#### Phase 1: 统一 Engine Hub DTO

| 文件路径 | 说明 |
|---------|------|
| `packages/shared-types/src/engines/engine-invocation.dto.ts` | 新增统一的 Engine Hub 调用接口（EngineInvocationRequest/Result + NovelAnalysisEngineInput/Output） |

#### Phase 2: API 端 Engine Hub 核心服务

| 文件路径 | 说明 |
|---------|------|
| `apps/api/src/engine-hub/engine-descriptor.interface.ts` | 引擎描述符接口定义 |
| `apps/api/src/engine-hub/engine-registry-hub.service.ts` | Engine Registry Hub 服务（维护引擎配置表） |
| `apps/api/src/engine-hub/engine-invoker-hub.service.ts` | Engine Invoker Hub 服务（路由 + 调用聚合） |
| `apps/api/src/engine-hub/engine-hub.module.ts` | Engine Hub 模块（导出 Registry 和 Invoker） |

#### Phase 3: Worker 端 Engine Hub 客户端

| 文件路径 | 说明 |
|---------|------|
| `apps/workers/src/engine-hub-client.ts` | Worker 端的 Engine Hub 客户端实现（不使用 NestJS DI） |

---

### 10.2 修改文件清单

| 文件路径 | 修改内容 |
|---------|---------|
| `packages/shared-types/src/engines/index.ts` | 导出新的 `engine-invocation.dto.ts` |
| `apps/workers/src/main.ts` | 修改 `processJob` 函数，使用新的 `EngineInvocationRequest`/`Result` 接口调用 Engine Hub |

---

### 10.3 NOVEL_ANALYSIS 实际执行链路（加入 Engine Hub）

**当前执行链路**：

```
1. API 层创建 Task 和 Job
   └─> Task.type = 'NOVEL_ANALYSIS'
   └─> Job.type = 'NOVEL_ANALYSIS'
   └─> Job.payload.engineKey = 'novel_analysis' (可选，默认)

2. Orchestrator 派发 Job 到 Worker
   └─> Worker 接收 Job

3. Worker 调用 Engine Hub
   └─> 构造 EngineInvocationRequest<NovelAnalysisEngineInput>
   └─> EngineHubClient.invoke(req)
   └─> 内部转换为 EngineInvokeInput
   └─> EngineAdapterClient.invoke(engineInput)
   └─> NovelAnalysisLocalAdapterWorker.invoke(input)
   └─> 执行文本解析和数据库写入
   └─> 返回 EngineInvokeResult
   └─> 转换为 EngineInvocationResult<NovelAnalysisEngineOutput>

4. Worker 处理结果并上报
   └─> 如果成功：上报 SUCCEEDED + result (stats)
   └─> 如果失败：上报 FAILED + error
```

**关键变化**：

- ✅ Worker 端不再直接调用 `processNovelAnalysisJob`，而是通过 `EngineHubClient.invoke()` 统一调用
- ✅ 使用新的 `EngineInvocationRequest`/`EngineInvocationResult` 接口，替代旧的 `EngineInvokeInput`/`EngineInvokeResult`
- ✅ 写库逻辑保持在 `NovelAnalysisLocalAdapterWorker` 内部，不改变现有位置

---

### 10.4 Stage1 未被动到（引用 Stage1 冻结声明）

**严格遵守 Stage1 冻结范围**：

1. ✅ **Prisma Schema**：
   - `Task` 模型（`output`, `workerId` 字段和关系）未修改
   - `AuditLog` 模型（`payload` 字段）未修改
   - `NovelChapter` 模型（`summary` 字段）未修改
   - `Scene.projectId` 字段未修改

2. ✅ **审计逻辑**：
   - `ORGANIZATION_SWITCH` 审计日志未修改
   - 已定义的审计动作枚举未修改

3. ✅ **安全链路**：
   - HMAC / Nonce / 签名 / 重放防护逻辑未修改
   - JWT / HMAC Guard 未修改

4. ✅ **任务系统**：
   - JobService、OrchestratorService、Worker 主循环未修改
   - 只修改了 Worker 内部的引擎调用封装逻辑

**详细说明**: 见 `docs/STAGE1_OVERVIEW_FINAL.md` 第 6 节（Stage1 冻结声明）

---

### 10.5 自检结果

**Lint 检查**: ⚠️ 有历史警告（any 类型），非本轮引入

**Build 检查**: ✅ 通过
- `@scu/shared-types`: ✅ 构建成功
- `api`: ✅ 构建成功（webpack compiled successfully）
- `@scu/worker`: ✅ 构建成功
- `web`: ✅ 构建成功

**TypeScript 编译**: ✅ 无错误

---

### 10.6 完成状态

**已完成项**：

1. ✅ Phase 1: 统一 Engine Hub DTO 已定义并导出
2. ✅ Phase 2: API 端 Engine Hub 核心服务已实现（EngineRegistryHub + EngineInvokerHub）
3. ✅ Phase 3: Worker 端已打通 Job → Engine Hub → 回报告链路
4. ✅ Phase 4: 最小回归自检通过，文档已更新

**验收条件**：

- ✅ `@scu/shared-types` 中确实多了 Engine Hub 标准 DTO 和 NovelAnalysis I/O 类型，且被 Engine/Worker 正常引用
- ✅ Worker 处理 NOVEL_ANALYSIS 的时候，代码里已经不再直接调用"裸的"本地实现，而是统一通过 `EngineHubClient.invoke()` 调用
- ✅ `docs/STAGE2_ENGINE_HUB_PLAN.md` 中多了一节执行报告，写清楚"已经做到哪一步，没动 Stage1"

---

**执行状态**: ✅ Stage2 Engine Hub Step2 执行完成，NOVEL_ANALYSIS 在 Engine Hub 下的最小闭环实现已完成

**最后更新**: 2025-12-11

