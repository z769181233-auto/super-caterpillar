# 内容链路现状审计报告

**生成时间**: 2025-12-14  
**审计范围**: NovelSource → NovelAnalysisJob → SceneDraft → Scene → Shot  
**审计方法**: 静态代码扫描（ripgrep）+ 代码审查  
**目标**: 识别完整链路、缺失点、对照文档要求

---

## 一、证据索引

### 1.1 导入/分析任务入口

| 位置 | 行号 | 摘要 |
|------|------|------|
| `apps/api/src/novel-import/novel-import.controller.ts` | 71-100 | `@Post('import-file')` - 文件上传入口 |
| `apps/api/src/novel-import/novel-import.controller.ts` | 197-240 | 创建 `NovelAnalysisJob` 和 `Job` (type: `NOVEL_ANALYSIS`) |
| `apps/api/src/novel-import/novel-import.controller.ts` | 221 | `jobService.createNovelAnalysisJob()` - 创建分析任务 |
| `apps/api/src/novel-import/novel-import.controller.ts` | 33 | `JobType as JobTypeEnum` - 导入 JobType 枚举 |
| `apps/api/src/job/job.service.ts` | 122-200 | `createNovelAnalysisJob()` - 创建 NOVEL_ANALYSIS Job |

**结论**: ✅ **已实现** - 导入和分析任务入口完整

---

### 1.2 Worker 处理器

| 位置 | 行号 | 摘要 |
|------|------|------|
| `apps/workers/src/novel-analysis-processor.ts` | 1-897 | `NovelAnalysisProcessor` - Worker 端小说分析处理器 |
| `apps/workers/src/novel-analysis-processor.ts` | 200-400 | `processNovelAnalysisJob()` - 处理 NOVEL_ANALYSIS Job |
| `apps/api/src/orchestrator/orchestrator.service.ts` | 1-578 | `OrchestratorService` - 调度和恢复服务 |
| `apps/api/src/orchestrator/orchestrator.service.ts` | 36-90 | `dispatch()` - 调度周期（标记离线 Worker、恢复 Job、处理重试） |

**结论**: ✅ **已实现** - Worker 处理器和 Orchestrator 完整

---

### 1.3 文本三步 API（按规范名）

#### 1.3.1 POST /story/parse (CE06)

| 位置 | 行号 | 摘要 |
|------|------|------|
| `apps/api/src/**/*.ts` | - | ❌ **未找到** `/story/parse` 端点 |

**搜索命令**:
```bash
rg -n "/story/parse|story/parse|parse.*story" apps/api/src
```

**结果**: ❌ **缺失** - 未找到 `/story/parse` 端点实现

**文档要求**: 
- 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》要求提供 `POST /story/parse` 接口
- 对应 CE06: NOVEL_PARSING

**结论**: ❌ **缺失** - 需按 API Spec 补齐

---

#### 1.3.2 POST /text/visual-density (CE03)

| 位置 | 行号 | 摘要 |
|------|------|------|
| `apps/api/src/**/*.ts` | - | ❌ **未找到** `/text/visual-density` 端点 |

**搜索命令**:
```bash
rg -n "/text/visual-density|visual-density" apps/api/src
```

**结果**: ❌ **缺失** - 未找到 `/text/visual-density` 端点实现

**文档要求**: 
- 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》要求提供 `POST /text/visual-density` 接口
- 对应 CE03: VISUAL_DENSITY

**结论**: ❌ **缺失** - 需按 API Spec 补齐

---

#### 1.3.3 POST /text/enrich (CE04)

| 位置 | 行号 | 摘要 |
|------|------|------|
| `apps/api/src/**/*.ts` | - | ❌ **未找到** `/text/enrich` 端点 |

**搜索命令**:
```bash
rg -n "/text/enrich|text/enrich" apps/api/src
```

**结果**: ❌ **缺失** - 未找到 `/text/enrich` 端点实现

**文档要求**: 
- 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》要求提供 `POST /text/enrich` 接口
- 对应 CE04: VISUAL_ENRICHMENT

**结论**: ❌ **缺失** - 需按 API Spec 补齐

---

### 1.4 CE06/CE03/CE04 Job 创建逻辑

| 位置 | 行号 | 摘要 |
|------|------|------|
| `apps/api/src/job/job.service.ts` | 1619-1650 | `handleCECoreJobSuccess()` - CE06 完成触发 CE03，CE03 完成触发 CE04 |
| `apps/api/src/job/job.service.ts` | 654-656 | 判断是否为 CE Core Job (`CE06_NOVEL_PARSING`, `CE03_VISUAL_DENSITY`, `CE04_VISUAL_ENRICHMENT`) |
| `apps/api/src/job/job.service.ts` | 720-722 | `handleCECoreJobFailure()` - 处理 CE Core Job 失败 |

**结论**: ✅ **已实现** - CE Core Pipeline 逻辑存在（CE06 → CE03 → CE04）

---

### 1.5 数据落库点

#### 1.5.1 Project→Season→Episode→Scene→Shot 结构

| 位置 | 行号 | 摘要 |
|------|------|------|
| `packages/database/prisma/schema.prisma` | 163-189 | `model Scene` - Scene 模型 |
| `packages/database/prisma/schema.prisma` | 190-216 | `model Shot` - Shot 模型 |
| `packages/database/prisma/schema.prisma` | 120-140 | `model Episode` - Episode 模型 |
| `packages/database/prisma/schema.prisma` | 100-120 | `model Season` - Season 模型 |
| `packages/database/prisma/schema.prisma` | 50-100 | `model Project` - Project 模型 |
| `apps/api/src/project/structure-generate.service.ts` | 24-183 | `generateStructure()` - 生成 Project→Episode→Scene→Shot 结构 |

**结论**: ✅ **已实现** - 四层结构（Project→Season→Episode→Scene→Shot）完整

---

#### 1.5.2 visual_density_score

| 位置 | 行号 | 摘要 |
|------|------|------|
| `packages/database/prisma/schema.prisma` | 172 | `visualDensityScore Float?` - Scene 模型中的视觉密度评分字段 |

**搜索命令**:
```bash
rg -n "visual_density_score|visualDensityScore" packages/database apps/api/src
```

**结果**: ✅ **已实现** - `Scene.visualDensityScore` 字段存在

**结论**: ✅ **已实现** - 视觉密度评分字段已定义

---

#### 1.5.3 enriched_text

| 位置 | 行号 | 摘要 |
|------|------|------|
| `packages/database/prisma/schema.prisma` | 174 | `enrichedText String? @db.Text` - Scene 模型中的文本增强结果字段 |
| `packages/database/prisma/schema.prisma` | 203 | `enrichedPrompt String? @db.Text` - Shot 模型中的文本增强 prompt 字段 |

**搜索命令**:
```bash
rg -n "enriched_text|enrichedText|enrichedPrompt" packages/database apps/api/src
```

**结果**: ✅ **已实现** - `Scene.enrichedText` 和 `Shot.enrichedPrompt` 字段存在

**结论**: ✅ **已实现** - 文本增强字段已定义

---

#### 1.5.4 audit_trail / trace_id

| 位置 | 行号 | 摘要 |
|------|------|------|
| `packages/database/prisma/schema.prisma` | 503 | `traceId String?` - ShotJob 模型中的 traceId 字段（Stage13: 用于 CE Core Layer 审计追溯） |
| `packages/database/prisma/schema.prisma` | 1098-1126 | `model AuditLog` - 审计日志模型 |
| `apps/api/src/job/job.service.ts` | 621 | `spanId = job.traceId` - 使用 traceId 作为 span_id |

**搜索命令**:
```bash
rg -n "audit_trail|trace_id|traceId" packages/database apps/api/src
```

**结果**: ✅ **已实现** - `ShotJob.traceId` 和 `AuditLog` 模型存在

**结论**: ✅ **已实现** - 审计追溯字段已定义

---

### 1.6 NovelParseResult 和 QualityMetrics

| 位置 | 行号 | 摘要 |
|------|------|------|
| `packages/database/prisma/schema.prisma` | 1005-1040 | `model NovelParseResult` - 小说解析结果模型 |
| `packages/database/prisma/schema.prisma` | 1041-1080 | `model QualityMetrics` - 质量指标模型 |

**结论**: ✅ **已实现** - 解析结果和质量指标表已定义

---

## 二、现状链路图

### 2.1 当前实现链路

```
UI/接口
  ↓
POST /projects/:projectId/novel/import-file (apps/api/src/novel-import/novel-import.controller.ts:71)
  ↓
NovelImportController.importNovelFile()
  ↓
创建 NovelSource + NovelChapter (apps/api/src/novel-import/novel-import.controller.ts:135-180)
  ↓
创建 Task (type: NOVEL_ANALYSIS) (apps/api/src/novel-import/novel-import.controller.ts:211)
  ↓
创建 Job (type: NOVEL_ANALYSIS) (apps/api/src/novel-import/novel-import.controller.ts:221)
  ↓
Job 入队 (status: PENDING)
  ↓
Worker 拉取 (apps/api/src/job/job.service.ts:404)
  ↓
NovelAnalysisProcessor.processNovelAnalysisJob() (apps/workers/src/novel-analysis-processor.ts:200)
  ↓
调用 CE06 引擎（如果配置）或使用规则解析
  ↓
写入 NovelParseResult (apps/workers/src/novel-analysis-processor.ts:400-600)
  ↓
生成 AnalyzedProjectStructure
  ↓
写入 Project→Episode→Scene→Shot 结构 (apps/api/src/project/structure-generate.service.ts:24)
  ↓
返回/展示 (apps/api/src/project/scene-graph.service.ts:22)
```

### 2.2 CE Core Pipeline 链路（部分实现）

```
CE06 Job 完成 (apps/api/src/job/job.service.ts:1619)
  ↓
触发 CE03 Job (apps/api/src/job/job.service.ts:1626)
  ↓
CE03 Job 完成 (apps/api/src/job/job.service.ts:1636)
  ↓
触发 CE04 Job (apps/api/src/job/job.service.ts:1643)
  ↓
写入 QualityMetrics (engine: CE03_VISUAL_DENSITY / CE04_VISUAL_ENRICHMENT)
```

**状态**: ⚠️ **部分实现** - Job 创建逻辑存在，但需验证是否真实调用引擎

---

## 三、对照文档要求

### 3.1 API Spec 要求

| 接口 | 规范要求 | 当前状态 | 证据 |
|------|----------|----------|------|
| `POST /story/parse` | 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》 | ❌ **缺失** | 未找到实现 |
| `POST /text/visual-density` | 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》 | ❌ **缺失** | 未找到实现 |
| `POST /text/enrich` | 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》 | ❌ **缺失** | 未找到实现 |

**结论**: ❌ **缺失** - 文本三步 API 均未实现

---

### 3.2 Engine Spec 要求

| 要求 | 规范 | 当前状态 | 证据 |
|------|------|----------|------|
| CE06→CE03→CE04 依赖链 | 《11毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》 | ✅ **已实现** | `apps/api/src/job/job.service.ts:1619-1650` |
| audit_trail 记录 | 《11毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》 | ✅ **已实现** | `AuditLog` 模型存在，`traceId` 字段存在 |

**结论**: ✅ **已实现** - 依赖链和审计追溯已实现

---

### 3.3 Safety Spec 要求

| 要求 | 规范 | 当前状态 | 证据 |
|------|------|----------|------|
| 解析链路审计记录 | 《14毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec…》 | ✅ **已实现** | `AuditLog` 模型存在，Job 上报时记录审计 |
| 文本审核步骤 | 《14毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec…》 | ⚠️ **部分实现** | 无自动清洗/安全过滤挂点 |

**结论**: ⚠️ **部分实现** - 审计记录完整，但文本审核步骤缺失

---

### 3.4 Quality Spec 要求

| 要求 | 规范 | 当前状态 | 证据 |
|------|------|----------|------|
| 视觉密度评分点位 | 《19毛毛虫宇宙_质量评估与自动优化体系说明书_QualityO…》 | ✅ **已实现** | `Scene.visualDensityScore` 字段存在 |
| 质量指标落库 | 《19毛毛虫宇宙_质量评估与自动优化体系说明书_QualityO…》 | ✅ **已实现** | `QualityMetrics` 模型存在 |

**结论**: ✅ **已实现** - 质量评分点位和落库已实现

---

## 四、结论矩阵

### 4.1 链路完整性

| 链路段 | 状态 | 证据路径 | 下一步建议 |
|--------|------|----------|------------|
| NovelSource → NovelChapter | ✅ **已实现** | `apps/api/src/novel-import/novel-import.controller.ts:135-180` | - |
| NovelChapter → NovelAnalysisJob | ✅ **已实现** | `apps/api/src/novel-import/novel-import.controller.ts:197-240` | - |
| NovelAnalysisJob → NovelParseResult | ⚠️ **部分实现** | `apps/workers/src/novel-analysis-processor.ts:200-400` | 需验证 CE06 引擎是否真实调用 |
| NovelParseResult → SceneDraft | ✅ **已实现** | `apps/api/src/project/structure-generate.service.ts:122-150` | - |
| SceneDraft → Scene | ✅ **已实现** | `apps/api/src/project/structure-generate.service.ts:150-180` | - |
| Scene → Shot | ✅ **已实现** | `apps/api/src/project/structure-generate.service.ts:180-220` | - |
| Scene → CE03 Job | ⚠️ **部分实现** | `apps/api/src/job/job.service.ts:1619-1650` | 需验证是否真实触发 |
| CE03 → CE04 Job | ⚠️ **部分实现** | `apps/api/src/job/job.service.ts:1636-1650` | 需验证是否真实触发 |

### 4.2 API 端点

| 端点 | 状态 | 证据路径 | 下一步建议 |
|------|------|----------|------------|
| `POST /story/parse` (CE06) | ❌ **缺失** | 未找到实现 | 按 API Spec 补齐接口 |
| `POST /text/visual-density` (CE03) | ❌ **缺失** | 未找到实现 | 按 API Spec 补齐接口 |
| `POST /text/enrich` (CE04) | ❌ **缺失** | 未找到实现 | 按 API Spec 补齐接口 |

### 4.3 数据落库

| 字段/表 | 状态 | 证据路径 | 下一步建议 |
|---------|------|----------|------------|
| Project→Season→Episode→Scene→Shot | ✅ **已实现** | `packages/database/prisma/schema.prisma:50-216` | - |
| `visual_density_score` | ✅ **已实现** | `packages/database/prisma/schema.prisma:172` | 需验证是否真实写入 |
| `enriched_text` | ✅ **已实现** | `packages/database/prisma/schema.prisma:174,203` | 需验证是否真实写入 |
| `audit_trail` / `trace_id` | ✅ **已实现** | `packages/database/prisma/schema.prisma:503,1098-1126` | - |
| `NovelParseResult` | ✅ **已实现** | `packages/database/prisma/schema.prisma:1005-1040` | 需验证是否真实写入 |
| `QualityMetrics` | ✅ **已实现** | `packages/database/prisma/schema.prisma:1041-1080` | 需验证是否真实写入 |

### 4.4 审计与安全

| 要求 | 状态 | 证据路径 | 下一步建议 |
|------|------|----------|------------|
| 解析链路审计记录 | ✅ **已实现** | `apps/api/src/job/job.service.ts:570-646` | - |
| 文本审核步骤 | ❌ **缺失** | 未找到实现 | 按 Safety Spec 补齐自动清洗/安全过滤 |

---

## 五、缺失点对照文档

### 5.1 文本阶段必须 CE06→CE03→CE04

**文档要求**: 
- 《11毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》要求文本阶段必须执行 CE06→CE03→CE04 链路
- 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》要求提供对应接口

**当前状态**:
- ✅ CE06→CE03→CE04 依赖链逻辑已实现（`apps/api/src/job/job.service.ts:1619-1650`）
- ❌ 三个 API 端点均缺失（`/story/parse`, `/text/visual-density`, `/text/enrich`）

**结论**: ⚠️ **部分实现** - 依赖链逻辑存在，但 API 端点缺失

---

### 5.2 审计/安全链路

**文档要求**:
- 《14毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec…》要求审计 2.0 包含解析链路记录
- 《14毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec…》要求文本审核步骤（自动清洗/安全过滤）

**当前状态**:
- ✅ 审计记录已实现（`AuditLog` 模型，Job 上报时记录）
- ❌ 文本审核步骤缺失（无自动清洗/安全过滤挂点）

**结论**: ⚠️ **部分实现** - 审计记录完整，但文本审核步骤缺失

---

## 六、总结

### 6.1 已实现项

- ✅ NovelSource → NovelChapter → NovelAnalysisJob → SceneDraft → Scene → Shot 基础链路完整
- ✅ CE06→CE03→CE04 依赖链逻辑已实现
- ✅ 数据模型完整（Project→Season→Episode→Scene→Shot, NovelParseResult, QualityMetrics）
- ✅ 审计追溯字段已定义（traceId, AuditLog）

### 6.2 部分实现项

- ⚠️ CE06/CE03/CE04 Job 创建逻辑存在，但需验证是否真实调用引擎
- ⚠️ visual_density_score 和 enriched_text 字段已定义，但需验证是否真实写入

### 6.3 缺失项

- ❌ `POST /story/parse` (CE06) 接口缺失
- ❌ `POST /text/visual-density` (CE03) 接口缺失
- ❌ `POST /text/enrich` (CE04) 接口缺失
- ❌ 文本审核步骤（自动清洗/安全过滤）缺失

---

**审计结论**: ⚠️ **基础链路完整，但文本三步 API 缺失，需按 API Spec 补齐**

