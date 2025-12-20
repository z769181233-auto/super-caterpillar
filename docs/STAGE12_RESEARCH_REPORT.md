# Stage12 · PRD 强制前置链路打通 - RESEARCH 报告

**生成时间**: 2025-12-13  
**文档版本**: v1.0  
**状态**: 📋 RESEARCH 阶段（只读文档/现状，不写代码）

---

## 一、目标与范围

### 1.1 Stage12 目标

打通 **Upload Novel → CE06 → CE03 → CE04** 的强制前置链路，实现：
- **管线贯通**：确保从上传小说到最终输出的完整流程可执行
- **最小可用输出**：每个引擎阶段都有可验证的输出结果
- **审计 trace**：每个阶段的操作都有完整的审计日志记录

### 1.2 用户要求

**流程强制项**：
- Upload Novel（已实现）
- CE06（待确认）
- CE03（待确认）
- CE04（待确认）

**约束**：
- 只做 RESEARCH（只读文档/现状，不写代码）
- 未得到用户确认，不得进入 EXECUTE（写代码）

---

## 二、文档对齐检查

### 2.1 缺失的文档

**未找到以下文档**：
- ❌ `PRD V1.1`（流程强制项）
- ❌ `Architecture Spec V1.1`（Parsing Pipeline）
- ❌ `EngineSpec V1.1`（CE06/03/04 IO与审计）

**已找到的相关文档**：
- ✅ `docs/STAGE3_OVERVIEW_PLAN.md` - Novel Analysis 流程
- ✅ `docs/STAGE4_OVERVIEW_PLAN.md` - 内容增强引擎（Semantic Enhancement, Shot Planning, Structure QA）
- ✅ `docs/NOVEL_ANALYSIS_VERIFICATION_REPORT_V2.md` - Novel Analysis 验证报告
- ✅ `docs/STAGE2_ENGINE_HUB_PLAN.md` - Engine Hub 架构

### 2.2 文档对齐结论

**问题**：
- 用户提到的 `PRD V1.1`、`Architecture Spec V1.1`、`EngineSpec V1.1` 文档在代码库中未找到
- 用户提到的 `CE06`、`CE03`、`CE04` 引擎在代码中未找到直接引用

**假设**：
- `CE06`、`CE03`、`CE04` 可能是引擎的内部编号或别名
- 需要用户提供这些文档或确认引擎的实际 `engineKey`

---

## 三、代码现状定位

### 3.1 Novel Import 流程（已实现）

**入口**：
- `apps/api/src/novel-import/novel-import.controller.ts`
  - `POST /api/projects/:projectId/novel/import-file` - 上传文件
  - `POST /api/projects/:projectId/novel/import` - 文本导入
  - `POST /api/projects/:projectId/novel/analyze` - 触发分析

**流程**：
1. 上传/导入小说 → 创建 `NovelSource` 和 `NovelChapter`
2. 触发分析 → 创建 `Task` (type: `NOVEL_ANALYSIS`) 和 `ShotJob` (type: `NOVEL_ANALYSIS`)
3. Worker 领取 Job → 调用 `processNovelAnalysisJob` → 解析文本 → 生成 `Season/Episode/Scene/Shot` 结构

**相关文件**：
- `apps/api/src/novel-import/novel-import.service.ts`
- `apps/api/src/novel-import/novel-analysis-processor.service.ts`
- `apps/workers/src/novel-analysis-processor.ts`
- `apps/api/src/project/structure-generate.service.ts`

### 3.2 Engine Hub 现状

**已注册的引擎**（`apps/api/src/engine-hub/engine-registry-hub.service.ts`）：
- ✅ `novel_analysis` (mode: local, adapter: NovelAnalysisLocalAdapter)
- ✅ `semantic_enhancement` (mode: local, adapter: SemanticEnhancementLocalAdapter) - Stage4
- ✅ `shot_planning` (mode: local, adapter: ShotPlanningLocalAdapter) - Stage4
- ✅ `structure_qa` (mode: local, adapter: StructureQALocalAdapter) - Stage4

**引擎配置文件**：
- `apps/api/config/engines.json` - 引擎配置（需要检查内容）

### 3.3 JobType / Orchestrator / Worker 现状

**JobType 枚举**（`packages/database/prisma/schema.prisma`）：
- `NOVEL_ANALYSIS` - 小说分析
- 其他 JobType（需要检查完整列表）

**Orchestrator**：
- `apps/api/src/orchestrator/orchestrator.service.ts`
  - `dispatchNextJobForWorker(workerId)` - Worker 主动拉取 Job
  - 支持故障恢复、重试机制

**Worker**：
- `apps/workers/src/main.ts` - Worker 主循环
- `apps/workers/src/novel-analysis-processor.ts` - Novel Analysis 处理器
- `apps/workers/src/engine-adapter-client.ts` - Engine Adapter 客户端

### 3.4 CE06 / CE03 / CE04 引擎定位

**搜索结果**：
- ❌ 代码库中未找到 `CE06`、`CE03`、`CE04` 的直接引用
- ❌ `grep -i "ce06\|ce03\|ce04"` 无结果

**可能的情况**：
1. 这些引擎尚未实现
2. 这些引擎使用不同的命名（如 `novel_analysis`、`semantic_enhancement` 等）
3. 这些引擎在 `engines.json` 中配置，但代码中未引用

**需要确认**：
- `CE06`、`CE03`、`CE04` 对应的实际 `engineKey` 是什么？
- 这些引擎是否已经实现？如果未实现，是否需要新建？
- 这些引擎的输入/输出 DTO 是什么？

---

## 四、现有流程分析

### 4.1 Upload Novel → NOVEL_ANALYSIS 流程（已实现）

```
1. 用户上传小说文件
   └─> POST /api/projects/:projectId/novel/import-file
   └─> 创建 NovelSource + NovelChapter

2. 用户触发分析
   └─> POST /api/projects/:projectId/novel/analyze
   └─> 创建 Task (NOVEL_ANALYSIS) + ShotJob (NOVEL_ANALYSIS)

3. Worker 领取 Job
   └─> POST /api/workers/:workerId/jobs/next
   └─> OrchestratorService.dispatchNextJobForWorker()

4. Worker 处理 Job
   └─> processNovelAnalysisJob()
   └─> basicTextSegmentation() - 解析文本
   └─> applyAnalyzedStructureToDatabase() - 写入 Season/Episode/Scene/Shot

5. Job 完成
   └─> Job.status = SUCCEEDED
   └─> Task.status = DONE
```

### 4.2 缺失的流程（CE06 → CE03 → CE04）

**问题**：
- 当前流程在 `NOVEL_ANALYSIS` 完成后直接结束
- 没有后续的 `CE06`、`CE03`、`CE04` 引擎调用链路

**需要设计**：
1. `NOVEL_ANALYSIS` 完成后如何触发 `CE06`？
2. `CE06` 完成后如何触发 `CE03`？
3. `CE03` 完成后如何触发 `CE04`？
4. 每个引擎的输入/输出数据格式是什么？
5. 如何确保数据在引擎间正确传递？

---

## 五、数据结构现状

### 5.1 已实现的数据结构

**NovelSource / NovelChapter**：
- `NovelSource` - 小说源（rawText, novelTitle, novelAuthor）
- `NovelChapter` - 章节（title, rawText, orderIndex）

**Project Structure**：
- `Season` - 季（已实现，但当前流程中未使用）
- `Episode` - 集（关联 NovelChapter）
- `Scene` - 场景
- `Shot` - 镜头

**Task / Job**：
- `Task` - 任务（type: NOVEL_ANALYSIS, status: PENDING/RUNNING/DONE/ERROR）
- `ShotJob` - Job（type: NOVEL_ANALYSIS, payload: { projectId, novelSourceId }）

### 5.2 缺失的数据结构（CE06/03/04）

**需要确认**：
- `CE06` 的输入/输出数据结构是什么？
- `CE03` 的输入/输出数据结构是什么？
- `CE04` 的输入/输出数据结构是什么？
- 这些数据是否需要新的数据库表？
- 还是复用现有的 `Season/Episode/Scene/Shot` 结构？

---

## 六、审计与 Trace 现状

### 6.1 已实现的审计

**审计日志**：
- `AuditLog` 表（action, resourceType, resourceId, payload）
- `AuditInterceptor` - 全局拦截器
- `AuditService` - 审计服务

**已审计的操作**：
- `PROJECT_UPDATE` - 项目更新（包括 Novel Import）
- `JOB_DISPATCHED` - Job 派发
- `NOVEL_ANALYSIS_RUN` - Novel Analysis 运行（Stage4）

### 6.2 缺失的审计（CE06/03/04）

**需要确认**：
- `CE06`、`CE03`、`CE04` 的运行是否需要审计日志？
- 审计日志的 `action` 枚举值是什么？
- 审计日志需要记录哪些信息（input/output/error）？

---

## 七、关键问题清单

### 7.1 文档问题

1. ❓ `PRD V1.1`、`Architecture Spec V1.1`、`EngineSpec V1.1` 文档在哪里？
2. ❓ `CE06`、`CE03`、`CE04` 引擎的具体定义是什么？
3. ❓ 这些引擎的输入/输出 DTO 是什么？

### 7.2 实现问题

4. ❓ `CE06`、`CE03`、`CE04` 是否已经实现？如果未实现，是否需要新建？
5. ❓ 这些引擎的 `engineKey` 是什么？（如 `ce06`、`ce03`、`ce04` 还是其他名称？）
6. ❓ 这些引擎的调用方式是什么？（Local Adapter 还是 HTTP Adapter？）

### 7.3 流程问题

7. ❓ `NOVEL_ANALYSIS` 完成后如何自动触发 `CE06`？
8. ❓ `CE06` 完成后如何自动触发 `CE03`？
9. ❓ `CE03` 完成后如何自动触发 `CE04`？
10. ❓ 是否需要支持手动触发某个引擎？

### 7.4 数据问题

11. ❓ 每个引擎的输入数据来源是什么？（数据库表、Job.payload、Task.payload？）
12. ❓ 每个引擎的输出数据存储在哪里？（数据库表、Job.payload.result、Task.output？）
13. ❓ 是否需要新的数据库表来存储中间结果？

### 7.5 审计问题

14. ❓ 每个引擎的运行是否需要审计日志？
15. ❓ 审计日志的 `action` 枚举值是什么？（如 `CE06_RUN`、`CE03_RUN`、`CE04_RUN`？）

---

## 八、下一步行动（等待用户确认）

### 8.1 必须等待用户提供的信息

1. **文档位置**：
   - `PRD V1.1`、`Architecture Spec V1.1`、`EngineSpec V1.1` 的路径或内容

2. **引擎定义**：
   - `CE06`、`CE03`、`CE04` 的 `engineKey`、输入/输出 DTO、调用方式

3. **流程设计**：
   - 引擎间的触发机制（自动还是手动？）
   - 数据传递方式（Job.payload、Task.payload、数据库表？）

### 8.2 建议的 PLAN 结构（待用户确认后生成）

**MODE: PLAN** 应包含：
1. **文件清单**：需要修改/新建的文件列表
2. **API 清单**：需要新增/修改的 API 端点
3. **数据结构清单**：需要新增/修改的数据库表/DTO
4. **引擎注册清单**：需要在 Engine Hub 中注册的引擎
5. **流程设计**：引擎间的触发机制和数据传递方式
6. **审计设计**：每个引擎的审计日志记录方式
7. **验收命令**：如何验证整个流程
8. **TEST_REPORT 模板**：`TEST_REPORT_STAGE12_*.md` 的结构

---

## 九、结论

### 9.1 RESEARCH 完成状态

✅ **已完成**：
- 定位了 Novel Import 流程的现有实现
- 定位了 Engine Hub 的现有架构
- 定位了 Job/Orchestrator/Worker 的现有机制
- 识别了缺失的文档和引擎定义

❌ **未完成**（需要用户提供）：
- `PRD V1.1`、`Architecture Spec V1.1`、`EngineSpec V1.1` 文档
- `CE06`、`CE03`、`CE04` 引擎的具体定义
- 引擎间的流程设计

### 9.2 阻塞点

**主要阻塞**：
- 缺少 `CE06`、`CE03`、`CE04` 引擎的定义和实现状态
- 缺少引擎间的流程设计文档

**建议**：
- 用户提供 `PRD V1.1`、`Architecture Spec V1.1`、`EngineSpec V1.1` 文档
- 或用户直接说明 `CE06`、`CE03`、`CE04` 的 `engineKey`、输入/输出、调用方式
- 确认后进入 `MODE: PLAN` 阶段

---

**RESEARCH 阶段完成，等待用户确认后进入 PLAN 阶段。**

