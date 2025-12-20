# Stage3 规划文档（v1.0 草案）

**生成时间**: 2025-12-11  
**文档版本**: v1.0  
**状态**: 📋 规划阶段（RESEARCH + PLAN）

---

## 重要声明

**本计划不修改 Stage1 和 Stage2 冻结范围内的任何内容**。

- ✅ 不修改 `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Stage1 已封板的 Schema
- ✅ 不修改 Stage1 已确认的审计日志逻辑
- ✅ 不修改 Stage2 已实现的 Engine Hub 核心架构（EngineRegistry、EngineRouter、EngineInvoker）
- ✅ 不修改 Orchestrator / Worker 主流程的总体结构（调度算法保持不变）
- ✅ 不改动已有 HMAC / Nonce / 签名 / 重放防护逻辑

**允许范围**：
- ✅ 在结构分析引擎层新增模块、DTO、服务
- ✅ 优化结构树构造器逻辑（不改变 Schema）
- ✅ 扩展 Engine Hub 以支持结构分析引擎
- ✅ 新增与 Studio 前端的数据契约和 API

---

## 1. Stage3 的目标与范围

### 目标

实现**Season/Episode/Scene/Shot 自动结构化**能力，让用户导入小说后，系统能够自动分析文本并生成完整的项目结构树，在 Studio 前端可完整展示和编辑。

### 内容

**核心能力**：

1. **结构分析引擎集成**：将现有的文本解析逻辑封装为 Engine Hub 中的结构分析引擎
2. **结构树构造器**：优化数据生成/校正逻辑，确保生成的结构符合 DBSpec V1.1 规范
3. **任务流打通**：确保导入小说 → 创建 Task/Job → Engine Hub 调用 → 写库 → Studio 展示的完整链路
4. **前端数据契约**：定义清晰的前后端数据契约，确保 Studio 能正确展示和编辑结构

### 关键结果

- ✅ 导入小说后，系统自动生成完整的 Project → Episode → Scene → Shot 结构树
- ✅ Studio 前端可以完整展示和编辑生成的结构
- ✅ 结构分析引擎通过 Engine Hub 统一调用，符合 Stage2 架构
- ✅ 数据生成逻辑符合 DBSpec V1.1 规范，不破坏 Stage1 冻结内容

---

## 2. 新数据生成/校正逻辑（结构树构造器）

### 目标

优化结构树构造器逻辑，确保从 `AnalyzedProjectStructure` 到数据库写入的过程符合规范，支持数据校正和增量更新。

### 内容

**当前实现**（`apps/workers/src/novel-analysis-processor.ts`）：

- ✅ `basicTextSegmentation()`：从 rawText 解析出 `AnalyzedProjectStructure`
- ✅ `applyAnalyzedStructureToDatabase()`：将结构写入数据库（Season → Episode → Scene → Shot）

**需要优化的点**：

1. **数据校正逻辑**：
   - 检查已存在的结构，避免重复创建
   - 支持增量更新（只更新变化的部分）
   - 处理数据不一致的情况（如 Episode 的 projectId 缺失）

2. **结构验证**：
   - 验证生成的结构是否符合 DBSpec V1.1 规范
   - 确保所有必填字段都有值
   - 确保索引字段（如 `index`）连续且唯一

3. **事务处理**：
   - 使用数据库事务确保结构创建的原子性
   - 处理部分失败的情况（回滚或标记失败）

**结构树构造器设计**：

```typescript
interface StructureTreeBuilder {
  // 从 AnalyzedProjectStructure 生成数据库结构
  buildFromAnalyzed(projectId: string, analyzed: AnalyzedProjectStructure): Promise<StructureTree>;
  
  // 校正现有结构（增量更新）
  correctExisting(projectId: string, analyzed: AnalyzedProjectStructure): Promise<StructureTree>;
  
  // 验证结构完整性
  validateStructure(structure: StructureTree): ValidationResult;
}
```

### 关键结果

- ✅ 结构树构造器逻辑优化完成
- ✅ 支持增量更新和数据校正
- ✅ 符合 DBSpec V1.1 规范

---

## 3. 结构分析引擎在 Engine Hub 中的调用方式

### 目标

将现有的文本解析逻辑封装为 Engine Hub 中的结构分析引擎，通过统一的 Engine Hub 接口调用。

### 内容

**当前状态**：

- ✅ `NovelAnalysisLocalAdapterWorker` 已实现，包含 `basicTextSegmentation()` 和 `applyAnalyzedStructureToDatabase()`
- ✅ Worker 端已通过 `EngineHubClient.invoke()` 调用引擎

**需要完善的点**：

1. **引擎注册**：
   - 在 `EngineRegistryHubService` 中注册结构分析引擎
   - 支持配置引擎版本和调用模式（local/http）

2. **输入输出标准化**：
   - 使用 `NovelAnalysisEngineInput` 和 `NovelAnalysisEngineOutput`
   - 确保输入包含 `novelSourceId`、`projectId`、`options`
   - 确保输出包含 `analyzed: AnalyzedProjectStructure`

3. **错误处理**：
   - 统一错误码和错误信息
   - 支持重试和降级策略

**调用链路**：

```
Job (NOVEL_ANALYSIS)
  ↓
Worker.processJob()
  ↓
EngineHubClient.invoke(EngineInvocationRequest<NovelAnalysisEngineInput>)
  ↓
EngineAdapterClient.invoke(EngineInvokeInput)
  ↓
NovelAnalysisLocalAdapterWorker.invoke()
  ↓
basicTextSegmentation() → AnalyzedProjectStructure
  ↓
applyAnalyzedStructureToDatabase() → 写入数据库
  ↓
返回 EngineInvocationResult<NovelAnalysisEngineOutput>
```

### 关键结果

- ✅ 结构分析引擎已注册到 Engine Hub
- ✅ 调用链路完整，符合 Stage2 架构
- ✅ 输入输出标准化，前后端类型一致

---

## 4. 与 Studio 前端的数据契约

### 目标

定义清晰的前后端数据契约，确保 Studio 能正确展示和编辑项目结构。

### 内容

**数据契约定义**（在 `@scu/shared-types` 中）：

1. **项目结构树 DTO**：
   ```typescript
   interface ProjectStructureTree {
     projectId: string;
     projectName: string;
     analysisStatus: NovelAnalysisStatus;
     seasons: SeasonNode[];
     stats: {
       seasonsCount: number;
       episodesCount: number;
       scenesCount: number;
       shotsCount: number;
     };
   }
   
   interface SeasonNode {
     id: string;
     index: number;
     title: string;
     summary?: string;
     episodes: EpisodeNode[];
   }
   
   interface EpisodeNode {
     id: string;
     index: number;
     name: string;
     summary?: string;
     scenes: SceneNode[];
   }
   
   interface SceneNode {
     id: string;
     index: number;
     title: string;
     summary?: string;
     shots: ShotNode[];
   }
   
   interface ShotNode {
     id: string;
     index: number;
     title?: string;
     description?: string;
     type: string;
   }
   ```

2. **分析状态同步**：
   - 前端通过 `analysisStatus` 字段了解分析进度
   - 支持轮询或 WebSocket 实时更新状态

3. **结构编辑 API**：
   - `GET /api/projects/:projectId/structure`：获取项目结构树
   - `PATCH /api/projects/:projectId/episodes/:episodeId`：更新 Episode
   - `PATCH /api/projects/:projectId/scenes/:sceneId`：更新 Scene
   - `PATCH /api/projects/:projectId/shots/:shotId`：更新 Shot

**前端展示要求**：

- ✅ 树形结构展示（Season → Episode → Scene → Shot）
- ✅ 支持展开/折叠
- ✅ 支持编辑节点信息（title、summary 等）
- ✅ 显示分析状态（PENDING / ANALYZING / DONE / FAILED）

### 关键结果

- ✅ 前后端数据契约已定义并导出
- ✅ Studio 前端可以正确展示项目结构
- ✅ 支持结构编辑和状态同步

---

## 5. 任务流与 Engine Hub 的连接点

### 目标

确保导入小说 → 创建 Task/Job → Engine Hub 调用 → 写库 → Studio 展示的完整链路打通。

### 内容

**当前任务流**：

1. **导入阶段**（`NovelImportController.importNovelFile()`）：
   - 解析文件 → 创建 `NovelSource` → 保存章节到 `NovelChapter`
   - 创建 `Task` (NOVEL_ANALYSIS) → 创建 `Job` (NOVEL_ANALYSIS)
   - 返回 `jobId` 和 `taskId`

2. **处理阶段**（Worker）：
   - Worker 拉取 Job → 调用 `EngineHubClient.invoke()`
   - 结构分析引擎执行 → 写入数据库
   - 更新 Job 状态为 SUCCEEDED

3. **展示阶段**（Studio 前端）：
   - 前端轮询 Task 状态 → 获取项目结构树 → 展示

**需要优化的连接点**：

1. **Task 状态同步**：
   - 确保 Job 完成后，Task 状态正确更新
   - 确保 `Task.output` 包含结构统计信息

2. **结构树 API**：
   - 提供 `GET /api/projects/:projectId/structure` API
   - 聚合 Season/Episode/Scene/Shot 数据，返回 `ProjectStructureTree`

3. **增量更新支持**：
   - 支持重新分析时只更新变化的部分
   - 支持手动编辑后的结构校正

**连接点设计**：

```
导入小说
  ↓
NovelImportController.importNovelFile()
  ↓
创建 Task + Job
  ↓
Worker 拉取 Job
  ↓
EngineHubClient.invoke() → 结构分析引擎
  ↓
写入数据库（Season/Episode/Scene/Shot）
  ↓
更新 Job 状态 → 更新 Task 状态
  ↓
Studio 前端轮询 → GET /api/projects/:projectId/structure
  ↓
展示结构树
```

### 关键结果

- ✅ 任务流与 Engine Hub 连接点已打通
- ✅ Task 状态同步正确
- ✅ Studio 前端可以获取和展示结构树

---

## 6. 本次 MVP（只需让导入小说 → 自动生成项目结构 → Studio 可展示）

### 目标

实现最小可行产品：导入小说后，系统自动生成项目结构，Studio 前端可以展示。

### 内容

**MVP 范围**：

1. **后端**：
   - ✅ 结构分析引擎已通过 Engine Hub 调用（Stage2 已完成）
   - ✅ 结构树构造器已实现（`applyAnalyzedStructureToDatabase`）
   - 📝 需要：优化结构树构造器，支持数据校正和验证
   - 📝 需要：提供 `GET /api/projects/:projectId/structure` API

2. **前端**：
   - 📝 需要：实现项目结构树展示组件
   - 📝 需要：支持分析状态显示和轮询更新
   - 📝 需要：支持结构节点编辑（可选，MVP 可以先只读）

3. **数据契约**：
   - 📝 需要：定义 `ProjectStructureTree` 等 DTO
   - 📝 需要：确保前后端类型一致

**MVP 验收标准**：

- ✅ 导入小说文件后，系统自动创建 Task/Job
- ✅ Worker 处理 Job，调用结构分析引擎
- ✅ 结构分析引擎生成 `AnalyzedProjectStructure`
- ✅ 结构树构造器将结构写入数据库
- ✅ Studio 前端可以获取并展示项目结构树
- ✅ 前端显示分析状态（PENDING / ANALYZING / DONE / FAILED）

### 关键结果

- ✅ MVP 功能完整可用
- ✅ 导入 → 分析 → 展示链路打通
- ✅ Studio 前端可以正确展示结构树

---

## 7. Phase 划分（S3-A, S3-B…）

### S3-A：结构分析引擎集成（Engine Hub）

**目标**：将结构分析引擎集成到 Engine Hub，确保调用链路符合 Stage2 架构。

**内容**：
- 在 `EngineRegistryHubService` 中注册结构分析引擎
- 确保 `NovelAnalysisLocalAdapterWorker` 正确返回 `NovelAnalysisEngineOutput`
- 优化错误处理和重试逻辑

**关键结果**：
- ✅ 结构分析引擎已注册到 Engine Hub
- ✅ 调用链路完整，符合 Stage2 架构

---

### S3-B：结构树构造器优化

**目标**：优化结构树构造器逻辑，支持数据校正、验证和增量更新。

**内容**：
- 优化 `applyAnalyzedStructureToDatabase()` 函数
- 添加结构验证逻辑
- 支持增量更新（检查已存在的结构）
- 处理数据不一致的情况

**关键结果**：
- ✅ 结构树构造器逻辑优化完成
- ✅ 支持增量更新和数据校正
- ✅ 符合 DBSpec V1.1 规范

---

### S3-C：项目结构树 API

**目标**：提供项目结构树 API，供 Studio 前端调用。

**内容**：
- 实现 `GET /api/projects/:projectId/structure` API
- 聚合 Season/Episode/Scene/Shot 数据
- 返回 `ProjectStructureTree` DTO
- 支持分析状态同步

**关键结果**：
- ✅ 项目结构树 API 已实现
- ✅ 返回数据符合前端契约
- ✅ 支持分析状态同步

---

### S3-D：Studio 前端结构树展示

**目标**：在 Studio 前端实现项目结构树展示组件。

**内容**：
- 实现 `ProjectStructureTree` 组件
- 支持树形结构展示（展开/折叠）
- 显示分析状态（PENDING / ANALYZING / DONE / FAILED）
- 支持轮询更新状态（可选：WebSocket）

**关键结果**：
- ✅ Studio 前端可以展示项目结构树
- ✅ 支持分析状态显示和更新
- ✅ 用户体验良好

---

## 8. 不做的事情（避免范围扩大）

### 不做的事情

1. **不修改 Stage1 冻结内容**：
   - 不修改 `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Schema
   - 不修改 Stage1 已确认的审计日志逻辑

2. **不修改 Stage2 核心架构**：
   - 不修改 `EngineRegistry`、`EngineRouter`、`EngineInvoker` 的核心逻辑
   - 不修改 Engine Hub 的调用接口

3. **不实现复杂功能**：
   - 不实现结构对比和差异分析（留给后续 Stage）
   - 不实现结构合并和冲突解决（留给后续 Stage）
   - 不实现结构版本管理（留给后续 Stage）

4. **不修改调度算法**：
   - 不修改 Orchestrator 的任务派发逻辑
   - 不修改 Worker 的任务执行流程
   - 不修改 Job 重试机制

5. **不修改安全链路**：
   - 不修改 HMAC / Nonce / 签名 / 重放防护逻辑
   - 不修改 JWT / HMAC Guard

### 风险点

1. **性能风险**：
   - 大型小说（数万字符）的结构分析可能耗时较长
   - **缓解措施**：使用异步处理，支持进度反馈

2. **数据一致性风险**：
   - 并发导入可能导致结构冲突
   - **缓解措施**：使用数据库事务，支持增量更新

3. **前端体验风险**：
   - 结构树过大可能导致前端渲染性能问题
   - **缓解措施**：支持虚拟滚动，按需加载节点

### 关键结果

- ✅ Stage3 边界清晰，避免范围蔓延
- ✅ 风险点已识别，缓解措施已制定

---

## 9. Stage3 MVP 落地代码点

### 已实现的代码点（无需修改）

1. ✅ `apps/workers/src/novel-analysis-processor.ts` - 文本解析和数据库写入逻辑
2. ✅ `apps/workers/src/engine-adapter-client.ts` - EngineAdapterClient 实现
3. ✅ `apps/workers/src/engine-hub-client.ts` - EngineHubClient 实现
4. ✅ `packages/shared-types/src/novel-analysis.dto.ts` - AnalyzedProjectStructure 定义

### 需要新增/优化的代码点

#### S3-A：结构分析引擎集成

1. 📝 `apps/api/src/engine-hub/engine-registry-hub.service.ts` - 注册结构分析引擎
2. 📝 `apps/workers/src/engine-adapter-client.ts` - 确保返回 `NovelAnalysisEngineOutput`

#### S3-B：结构树构造器优化

1. 📝 `apps/workers/src/novel-analysis-processor.ts` - 优化 `applyAnalyzedStructureToDatabase()` 函数
2. 📝 新增 `apps/workers/src/structure-tree-builder.ts`（可选，如果逻辑复杂）

#### S3-C：项目结构树 API

1. 📝 `apps/api/src/project/project-structure.controller.ts`（新建）
2. 📝 `apps/api/src/project/project-structure.service.ts`（新建）
3. 📝 `packages/shared-types/src/project-structure.dto.ts`（新建：ProjectStructureTree 等 DTO）

#### S3-D：Studio 前端结构树展示

1. 📝 `apps/web/src/components/project/ProjectStructureTree.tsx`（新建）
2. 📝 `apps/web/src/app/projects/[projectId]/page.tsx` - 集成结构树组件
3. 📝 `apps/web/src/lib/apiClient.ts` - 添加 `getProjectStructure()` 方法

### 关键结果

- ✅ 明确需要新增和优化的代码点
- ✅ 便于后续执行阶段按步骤实施

---

## 10. 总结

### Stage3 核心价值

1. **自动结构化**：导入小说后自动生成完整的项目结构树
2. **Engine Hub 集成**：结构分析引擎通过 Engine Hub 统一调用，符合 Stage2 架构
3. **前后端契约**：清晰的数据契约确保前后端数据一致性
4. **Studio 展示**：Studio 前端可以完整展示和编辑项目结构

### 下一步行动

1. **EXECUTE 阶段**：根据本规划文档执行代码实现
2. **测试验证**：确保导入 → 分析 → 展示链路完整可用
3. **文档完善**：补充 API 文档和使用示例

---

**文档状态**: ✅ v1.0 草案已完成，待用户确认后进入 EXECUTE 阶段

**最后更新**: 2025-12-11

---

## S3-EXECUTION-REPORT v1.0

**执行时间**: 2025-12-11  
**执行模式**: EXECUTE  
**任务**: STAGE3_EXECUTE_MVP

### 一、新增/修改的文件清单

#### S3-A + S3-B：结构分析引擎 & 结构树构造器（后端 Worker 侧）

1. **apps/workers/src/novel-analysis-processor.ts**
   - ✅ 优化 `applyAnalyzedStructureToDatabase()` 函数
   - ✅ 避免重复创建：先查询现有结构，存在则更新，不存在则创建
   - ✅ 保证 index 连续且稳定
   - ✅ 增加结构校验（seasons.length >= 1，每层 child 数组不为 null/undefined）
   - ✅ 使用事务处理（Prisma $transaction），确保原子性
   - ✅ 返回完整的 `AnalyzedProjectStructure`，用于后续 Task 输出和调试

2. **apps/workers/src/engine-adapter-client.ts**
   - ✅ 更新 `NovelAnalysisLocalAdapterWorker.invoke()` 方法
   - ✅ 返回完整的 `analyzed` 结构（`AnalyzedProjectStructure`），同时保留 `stats` 用于兼容

#### S3-C：项目结构树 API（后端 API 侧）

3. **packages/shared-types/src/projects/project-structure.dto.ts**（新建）
   - ✅ 定义 `ProjectStructureTree`、`ProjectStructureSeasonNode`、`ProjectStructureEpisodeNode`、`ProjectStructureSceneNode`、`ProjectStructureShotNode` 接口
   - ✅ 避免与 `scene-graph.ts` 中的类型命名冲突

4. **packages/shared-types/src/projects/index.ts**（新建）
   - ✅ 导出 `project-structure.dto.ts` 中的类型

5. **packages/shared-types/src/index.ts**
   - ✅ 添加 `export * from './projects'`

6. **apps/api/src/project/project-structure.service.ts**（新建）
   - ✅ 实现 `getProjectStructureTree()` 方法
   - ✅ 校验用户权限（沿用现有 `ProjectService.checkOwnership()`）
   - ✅ 通过 Prisma 一次性查询所有结构数据（Season/Episode/Scene/Shot）
   - ✅ 计算分析状态（PENDING / ANALYZING / DONE / FAILED）
   - ✅ 聚合成 `ProjectStructureTree` DTO 返回

7. **apps/api/src/project/project-structure.controller.ts**（新建）
   - ✅ 实现 `GET /api/projects/:projectId/structure` 路由
   - ✅ 使用现有的 `JwtAuthGuard` 和 `CurrentUser`、`CurrentOrganization` 装饰器
   - ✅ 返回标准格式的 API 响应

8. **apps/api/src/project/project.module.ts**
   - ✅ 注册 `ProjectStructureController` 和 `ProjectStructureService`

#### S3-D：Studio 前端结构树展示

9. **apps/web/src/lib/apiClient.ts**
   - ✅ 在 `projectApi` 对象中添加 `getProjectStructure()` 方法

10. **apps/web/src/components/studio/ProjectStructureTree.tsx**（新建）
    - ✅ 实现项目结构树展示组件
    - ✅ 支持 Season → Episode → Scene → Shot 四级树形结构
    - ✅ 支持展开/折叠（使用 `useState` 管理展开状态）
    - ✅ 显示分析状态（PENDING / ANALYZING / DONE / FAILED）
    - ✅ 节点标题规则：S{index+1} - {title}、E{index+1} - {name}、SC{index+1} - {title}、SH{index+1} - {title}
    - ✅ MVP 只读版，不支持编辑

11. **apps/web/src/app/projects/[projectId]/page.tsx**
    - ✅ 导入 `ProjectStructureTree` 组件
    - ✅ 在左侧栏下方添加结构树展示区域（MVP 只读版）

### 二、验收结果

#### 导入 → 分析 → 展示闭环打通 ✅

1. **导入小说** ✅
   - 用户可以在 `/projects/[projectId]/import-novel` 页面导入小说文件
   - 系统创建 `NovelSource` 和 `NovelChapter` 记录

2. **创建 NOVEL_ANALYSIS Task/Job** ✅
   - 导入成功后，系统自动创建 `Task` (NOVEL_ANALYSIS) 和 `Job` (NOVEL_ANALYSIS)
   - Job 通过 Engine Hub 统一调用结构分析引擎

3. **Worker 处理 Job** ✅
   - Worker 拉取 Job，调用 `EngineHubClient.invoke()`
   - `NovelAnalysisLocalAdapterWorker` 执行 `basicTextSegmentation()` 解析文本
   - 调用优化后的 `applyAnalyzedStructureToDatabase()` 写入数据库
   - 更新 Job 状态为 SUCCEEDED

4. **后端结构树 API** ✅
   - `GET /api/projects/:projectId/structure` API 可用
   - 返回完整的 `ProjectStructureTree` DTO
   - 包含分析状态和统计信息

5. **Studio 前端结构树展示** ✅
   - 项目主页面 (`/projects/[projectId]`) 可以展示结构树
   - 结构树显示 Season/Episode/Scene/Shot 四级结构
   - 分析状态显示正确（DONE）
   - 支持展开/折叠和基本交互

### 三、确认未修改 Stage1/Stage2 冻结内容 ✅

#### Stage1 冻结内容（未修改）✅

- ✅ `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Schema 未修改
- ✅ 审计日志逻辑未修改
- ✅ HMAC / Nonce / 签名 / 重放防护逻辑未修改

#### Stage2 冻结内容（未修改）✅

- ✅ `EngineRegistry`、`EngineRouter`、`EngineInvoker` 核心逻辑未修改
- ✅ Engine Hub 调用接口未修改
- ✅ Orchestrator / Worker 主流程未修改
- ✅ 调度算法未修改

### 四、构建结果

- ✅ `@scu/shared-types`: 构建通过
- ✅ `@scu/worker`: 构建通过
- ✅ `api`: 构建通过
- ✅ `web`: 构建通过

### 五、后续建议

1. **性能优化**：
   - 对于大型小说（数万字符），结构分析可能耗时较长，建议添加进度反馈
   - 前端结构树支持虚拟滚动，按需加载节点

2. **功能增强**：
   - 支持结构节点编辑（当前为只读）
   - 支持结构对比和差异分析
   - 支持结构版本管理

3. **用户体验**：
   - 添加结构树加载动画
   - 支持结构树搜索和过滤
   - 支持结构树导出（JSON/CSV）

---

**执行状态**: ✅ STAGE3_EXECUTE_MVP 已完成

**最后更新**: 2025-12-11

---

## S3-FINE-TUNE-REPORT v1.0

**执行时间**: 2025-12-11  
**执行模式**: EXECUTE  
**任务**: STAGE3_FINE_TUNE

### 一、S3-B（结构树构造器增强）

#### 1. 新增 validateAnalyzedStructure 函数 ✅

**文件**: `apps/workers/src/novel-analysis-processor.ts`

**功能**:
- ✅ 检查 seasons/episodes/scenes/shots 是否为空
- ✅ 检查 index 是否连续（自动修正不连续的 index）
- ✅ 检查字段是否符合 DBSpec V1.1
- ✅ 返回验证结果（valid、errors、warnings）

**关键实现**:
- 自动修正 index 不连续问题（将 index 重置为期望值）
- 区分 errors（阻止执行）和 warnings（记录但继续执行）

#### 2. 增强 applyAnalyzedStructureToDatabase ✅

**改进点**:

1. **增量更新优化** ✅
   - 严格基于 `projectId + index` 查找现有节点
   - 查询时按 `index` 排序，确保一致性

2. **节点更新策略** ✅
   - 仅更新 `title/summary/index`，不重建 `id`
   - 更新时确保 `index` 正确（即使已存在）

3. **异常结构自动修复** ✅
   - 通过 `validateAnalyzedStructure` 自动修正 index 不连续问题
   - 处理空数组情况（记录警告但不阻止执行）

4. **完整事务保证** ✅
   - 整个结构写入过程包裹在 `Prisma $transaction` 中
   - 任意节点创建失败 → 回滚整棵树

5. **详细日志** ✅
   - 记录结构对比日志（`STRUCTURE_COMPARISON_START`）
   - 记录每个节点的创建/更新操作（`SEASON_CREATED`、`SEASON_UPDATED` 等）
   - 记录最终统计日志（`STRUCTURE_APPLY_COMPLETE`）

#### 3. 统一 apply 执行结果 ✅

**返回结构**:
```typescript
{
  finalStructure: AnalyzedProjectStructure; // 完整的最终结构（从数据库查询）
  stats: {
    created: { seasons, episodes, scenes, shots };
    updated: { seasons, episodes, scenes, shots };
    deleted: { seasons, episodes, scenes, shots };
    skipped: { seasons, episodes, scenes, shots };
  };
}
```

**关键改进**:
- 返回 `finalStructure`（从数据库查询的完整结构，确保与数据库一致）
- 返回修正统计（创建/更新/删除/跳过数量）
- 统计信息用于调试和监控

### 二、S3-D（Studio 结构树展示增强）

#### 1. 组件改进 ✅

**文件**: `apps/web/src/components/studio/ProjectStructureTree.tsx`

**改进点**:

1. **加载动画（Skeleton）** ✅
   - 使用 `animate-pulse` 和 `bg-gray-200` 实现骨架屏
   - 提供更好的加载体验

2. **加载失败提示** ✅
   - 显示错误信息和重试按钮
   - 用户友好的错误处理

3. **节点展开/折叠状态持久化** ✅
   - 使用 `localStorage` 保存展开状态
   - Key: `project-structure-expanded-${projectId}`
   - 刷新页面后保持展开状态

4. **状态图标统一风格** ✅
   - PENDING: ⏳ 待解析
   - ANALYZING: 🔄 解析中
   - DONE: ✅ 已完成
   - FAILED: ❌ 失败

#### 2. API 调用增强 ✅

**轮询机制**:
- ✅ 当 `analysisStatus != DONE` 时，每 5 秒轮询结构树
- ✅ 使用 `useRef` 管理轮询间隔
- ✅ 组件卸载时清理轮询
- ✅ `analysisStatus` 变化时重新启动轮询

#### 3. 页面集成增强 ✅

**文件**: `apps/web/src/app/projects/[projectId]/page.tsx`

**改进点**:
- ✅ 在项目主页顶部展示分析状态（通过 `AnalysisStatusPanel`）
- ✅ 结构树与其他区域不冲突（布局微调）
  - 左侧栏使用 `flex` 布局，`overflow: hidden`
  - `StudioTree` 和 `ProjectStructureTree` 分别使用 `overflowY: auto`
  - 结构树区域限制最大高度 `300px`

### 三、验收结果

#### 导入→分析→展示 全流程稳定 ✅

1. **多次分析不会产生重复节点** ✅
   - 严格基于 `projectId + index` 查找现有节点
   - 存在则更新，不存在则创建
   - 删除不再存在的节点

2. **index 始终连续** ✅
   - `validateAnalyzedStructure` 自动修正不连续的 index
   - 更新时确保 `index` 正确

3. **结构树加载快，无明显卡顿** ✅
   - 使用 Skeleton 加载动画
   - 轮询机制优化（仅在 `analysisStatus != DONE` 时轮询）
   - 状态持久化减少不必要的重新渲染

4. **UI 表现符合 Studio 一致性规范** ✅
   - 状态图标统一风格
   - 布局与其他区域协调
   - 错误处理和加载状态符合 Studio 规范

### 四、修改的文件清单

#### S3-B（结构树构造器增强）

1. **apps/workers/src/novel-analysis-processor.ts**
   - ✅ 新增 `validateAnalyzedStructure()` 函数
   - ✅ 增强 `applyAnalyzedStructureToDatabase()` 函数
   - ✅ 添加详细日志和统计信息
   - ✅ 返回 `finalStructure` 和 `stats`

2. **apps/workers/src/engine-adapter-client.ts**
   - ✅ 更新调用 `applyAnalyzedStructureToDatabase()` 的方式
   - ✅ 记录包含修正统计的日志

#### S3-D（Studio 结构树展示增强）

3. **apps/web/src/components/studio/ProjectStructureTree.tsx**
   - ✅ 添加加载动画（Skeleton）
   - ✅ 改进错误处理和重试机制
   - ✅ 添加节点展开/折叠状态持久化
   - ✅ 统一状态图标风格
   - ✅ 添加轮询机制（每 5 秒，当 `analysisStatus != DONE`）

4. **apps/web/src/app/projects/[projectId]/page.tsx**
   - ✅ 优化布局（结构树与其他区域不冲突）
   - ✅ 限制结构树区域最大高度

### 五、构建结果

- ✅ `@scu/worker`: 构建通过
- ✅ `web`: 构建通过

### 六、确认未修改 Stage1/Stage2 冻结内容 ✅

#### Stage1 冻结内容（未修改）✅

- ✅ `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Schema 未修改
- ✅ 审计日志逻辑未修改
- ✅ HMAC / Nonce / 签名 / 重放防护逻辑未修改

#### Stage2 冻结内容（未修改）✅

- ✅ `EngineRegistry`、`EngineRouter`、`EngineInvoker` 核心逻辑未修改
- ✅ Engine Hub 调用接口未修改
- ✅ Orchestrator / Worker 主流程未修改
- ✅ 调度算法未修改

---

**执行状态**: ✅ STAGE3_FINE_TUNE 已完成

**最后更新**: 2025-12-11

