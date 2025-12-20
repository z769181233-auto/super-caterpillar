# 内容链路现状审计报告

**生成时间**: 2025-12-14  
**审计范围**: NovelSource → NovelAnalysisJob → SceneDraft → Scene → Shot  
**目标**: 识别完整链路、人工介入点、质量不可控点

---

## 一、内容链路流程图

```
NovelSource (小说源)
  ↓
NovelChapter (章节)
  ↓
NovelAnalysisJob (分析任务)
  ↓ [CE06: NOVEL_PARSING]
NovelParseResult (解析结果)
  ↓
SceneDraft (场景草稿)
  ↓
Scene (场景)
  ↓ [CE03: VISUAL_DENSITY]
QualityMetrics (质量指标 - CE03)
  ↓ [CE04: VISUAL_ENRICHMENT]
QualityMetrics (质量指标 - CE04)
  ↓
Shot (镜头)
```

---

## 二、每一步输入/输出示例

### 2.1 NovelSource → NovelChapter

**输入**:
- 文件上传：`.txt`, `.docx`, `.epub`, `.md`
- 或文本直接导入

**处理**:
- `FileParserService.parseFile()` 解析文件
- 提取文本内容
- 按章节切分（规则：匹配"第X章/回/集"）

**输出**:
```typescript
{
  id: "novel_source_id",
  projectId: "project_id",
  title: "小说标题",
  author: "作者",
  chapters: [
    {
      id: "chapter_id",
      orderIndex: 1,
      title: "第一章",
      rawText: "章节原文...",
    }
  ]
}
```

**位置**: `apps/api/src/novel-import/novel-import.controller.ts:100-270`

---

### 2.2 NovelChapter → NovelAnalysisJob

**输入**:
- `NovelChapter.id`
- `Project.id`

**处理**:
- 创建 `Task` (type: `NOVEL_ANALYSIS`)
- 创建 `Job` (type: `NOVEL_ANALYSIS`)
- 创建 `NovelAnalysisJob` 记录

**输出**:
```typescript
{
  taskId: "task_id",
  jobId: "job_id",
  novelAnalysisJobId: "novel_analysis_job_id",
  status: "PENDING"
}
```

**位置**: `apps/api/src/novel-import/novel-import.controller.ts:197-240`

---

### 2.3 NovelAnalysisJob → NovelParseResult (CE06)

**输入**:
- `Job.payload` (包含 `novelSourceId`, `chapterIds`)

**处理**:
- Worker 调用 CE06 引擎 (`CE06_NOVEL_PARSING`)
- 解析章节文本，提取结构（卷/章/场）
- 生成 `NovelParseResult`

**输出**:
```typescript
{
  projectId: "project_id",
  novelSourceId: "novel_source_id",
  structure: {
    volumes: [...],
    chapters: [...],
    scenes: [...]
  },
  metadata: {
    totalWords: 10000,
    totalChapters: 10
  }
}
```

**位置**: `apps/workers/src/novel-analysis-processor.ts`

**状态**: ⚠️ **部分实现** - Worker 有处理逻辑，但 CE06 引擎调用可能未完全集成

---

### 2.4 NovelParseResult → SceneDraft

**输入**:
- `NovelChapter.rawText`
- `NovelParseResult` (如果存在)

**处理**:
- `NovelAnalysisProcessorService.analyzeChapter()` 或
- `StructureGenerateService.generateStructure()`
- 按段落切分场景（规则：`paragraphs.length / 3`，最多 3 个场景）
- 提取场景摘要、地点、角色

**输出**:
```typescript
{
  id: "scene_draft_id",
  chapterId: "chapter_id",
  orderIndex: 1,
  title: "第一章 - 场景 1",
  summary: "场景摘要（前100字）",
  location: "地点",
  characters: [],
  status: "DRAFT" | "ANALYZED",
  rawTextRange: {
    startParagraph: 0,
    endParagraph: 2
  }
}
```

**位置**: 
- `apps/api/src/novel-import/novel-analysis-processor.service.ts:16-75`
- `apps/api/src/project/structure-generate.service.ts:122-150`

**状态**: ⚠️ **规则实现** - 使用简单规则切分，未使用 LLM

---

### 2.5 SceneDraft → Scene

**输入**:
- `SceneDraft.id`
- `Episode.id`

**处理**:
- `StructureGenerateService.generateStructure()` 创建 Scene
- 关联 SceneDraft 到 Scene

**输出**:
```typescript
{
  id: "scene_id",
  episodeId: "episode_id",
  sceneDraftId: "scene_draft_id",
  index: 1,
  title: "场景 1",
  summary: "场景摘要"
}
```

**位置**: `apps/api/src/project/structure-generate.service.ts:150-180`

**状态**: ✅ **已实现** - Scene 创建逻辑完整

---

### 2.6 Scene → Shot

**输入**:
- `Scene.id`
- `SceneDraft.rawText` (场景文本)

**处理**:
- 按句子切分 Shot（规则：句号/问号/叹号）
- 每个句子一个 Shot

**输出**:
```typescript
{
  id: "shot_id",
  sceneId: "scene_id",
  index: 1,
  title: "镜头 1",
  summary: "镜头摘要（前50字）",
  text: "镜头文本"
}
```

**位置**: `apps/api/src/project/structure-generate.service.ts:180-220`

**状态**: ✅ **已实现** - Shot 创建逻辑完整

---

### 2.7 CE03: VISUAL_DENSITY (质量指标)

**输入**:
- `Scene.id` 或 `Shot.id`
- 场景/镜头文本

**处理**:
- 创建 `Job` (type: `CE03_VISUAL_DENSITY`)
- 调用 CE03 引擎
- 生成 `QualityMetrics` (engine: `CE03_VISUAL_DENSITY`)

**输出**:
```typescript
{
  projectId: "project_id",
  engine: "CE03_VISUAL_DENSITY",
  metrics: {
    density: 0.8,
    complexity: 0.6,
    // ... 其他指标
  }
}
```

**位置**: `apps/api/src/job/job.service.ts` (CE Core Pipeline)

**状态**: ⚠️ **需验证** - Job 创建逻辑存在，但需确认是否真实调用

---

### 2.8 CE04: VISUAL_ENRICHMENT (质量指标)

**输入**:
- `Scene.id` 或 `Shot.id`
- CE03 质量指标结果

**处理**:
- 创建 `Job` (type: `CE04_VISUAL_ENRICHMENT`)
- 调用 CE04 引擎（依赖 CE03 成功）
- 生成 `QualityMetrics` (engine: `CE04_VISUAL_ENRICHMENT`)

**输出**:
```typescript
{
  projectId: "project_id",
  engine: "CE04_VISUAL_ENRICHMENT",
  metrics: {
    enrichment: 0.9,
    // ... 其他指标
  }
}
```

**位置**: `apps/api/src/job/job.service.ts` (CE Core Pipeline)

**状态**: ⚠️ **需验证** - Job 创建逻辑存在，但需确认是否真实调用

---

## 三、人工介入点

### 3.1 必须人工介入

| 步骤 | 位置 | 原因 | 当前状态 |
|------|------|------|----------|
| **SceneDraft 审核** | `SceneDraft.status = 'DRAFT'` | 场景草稿需要人工审核 | ⚠️ **未实现** - 无审核流程 |
| **Scene 质量审核** | `QualityMetrics` 生成后 | 质量指标需要人工判断是否合格 | ⚠️ **未实现** - 无质量审核流程 |
| **Shot 内容审核** | `Shot` 创建后 | 镜头内容需要人工审核 | ⚠️ **未实现** - 无审核流程 |

### 3.2 可选人工介入

| 步骤 | 位置 | 原因 | 当前状态 |
|------|------|------|----------|
| **NovelChapter 切分修正** | 章节切分后 | 规则切分可能不准确 | ⚠️ **未实现** - 无修正流程 |
| **SceneDraft 切分修正** | 场景切分后 | 规则切分可能不准确 | ⚠️ **未实现** - 无修正流程 |

---

## 四、质量不可控点

### 4.1 当前质量不可控点

| 点 | 位置 | 问题 | 影响 |
|----|------|------|------|
| **章节切分** | `FileParserService.parseFile()` | 规则切分，可能误切 | ⚠️ **中等** - 影响后续结构 |
| **场景切分** | `NovelAnalysisProcessorService.analyzeChapter()` | 规则切分（`paragraphs.length / 3`），可能不准确 | ⚠️ **高** - 直接影响 Scene 质量 |
| **场景摘要** | `StructureGenerateService.generateStructure()` | 简单提取前100字，无语义理解 | ⚠️ **高** - 摘要质量差 |
| **地点提取** | `extractLocation()` | 简单正则匹配，准确率低 | ⚠️ **中等** - 地点信息不准确 |
| **角色提取** | `analyzeChapter()` | 占位实现，返回空数组 | ⚠️ **高** - 角色信息缺失 |
| **Shot 切分** | `StructureGenerateService.generateStructure()` | 按句子切分，可能不准确 | ⚠️ **中等** - Shot 粒度可能不合适 |

### 4.2 质量可控点

| 点 | 位置 | 说明 | 状态 |
|----|------|------|------|
| **CE03 质量指标** | `CE03_VISUAL_DENSITY` | 引擎计算，结果可量化 | ✅ **可控** - 需验证是否真实调用 |
| **CE04 质量指标** | `CE04_VISUAL_ENRICHMENT` | 引擎计算，结果可量化 | ✅ **可控** - 需验证是否真实调用 |

---

## 五、链路完整性检查

### 5.1 已实现链路

| 链路段 | 状态 | 说明 |
|--------|------|------|
| NovelSource → NovelChapter | ✅ **完整** | 文件解析和章节切分已实现 |
| NovelChapter → NovelAnalysisJob | ✅ **完整** | Task/Job 创建已实现 |
| NovelAnalysisJob → NovelParseResult | ⚠️ **部分** | Worker 有逻辑，但 CE06 调用需验证 |
| NovelParseResult → SceneDraft | ✅ **完整** | 规则切分已实现 |
| SceneDraft → Scene | ✅ **完整** | Scene 创建已实现 |
| Scene → Shot | ✅ **完整** | Shot 创建已实现 |

### 5.2 缺失链路

| 链路段 | 状态 | 说明 |
|--------|------|------|
| Scene → CE03 Job | ⚠️ **需验证** | Job 创建逻辑存在，但需确认触发时机 |
| CE03 → CE04 Job | ⚠️ **需验证** | 依赖关系存在，但需确认触发时机 |
| QualityMetrics → 质量评价 | ❌ **缺失** | 无质量评价和审核流程 |
| QualityMetrics → 返工决策 | ❌ **缺失** | 无自动返工或人工返工流程 |

---

## 六、数据流验证

### 6.1 数据库表关系

```
NovelSource (1) → (N) NovelChapter
NovelChapter (1) → (N) SceneDraft
NovelChapter (1) → (1) Episode
Episode (1) → (N) Scene
Scene (1) → (N) Shot
SceneDraft (1) → (1) Scene (可选)
Project (1) → (N) QualityMetrics (CE03/CE04)
```

### 6.2 关键字段

| 表 | 关键字段 | 说明 |
|----|----------|------|
| `NovelSource` | `projectId`, `title`, `author` | 小说源 |
| `NovelChapter` | `novelSourceId`, `orderIndex`, `rawText` | 章节 |
| `SceneDraft` | `chapterId`, `orderIndex`, `status` | 场景草稿 |
| `Scene` | `episodeId`, `sceneDraftId`, `index` | 场景 |
| `Shot` | `sceneId`, `index`, `text` | 镜头 |
| `QualityMetrics` | `projectId`, `engine`, `metrics` | 质量指标 |

---

## 七、总结

### 7.1 链路完整性

- ✅ **基础链路完整**: NovelSource → NovelChapter → SceneDraft → Scene → Shot
- ⚠️ **质量链路部分**: CE03/CE04 Job 创建逻辑存在，但需验证是否真实调用
- ❌ **质量评价缺失**: 无质量评价和审核流程

### 7.2 人工介入需求

- ❌ **无审核流程**: SceneDraft、Scene、Shot 均无审核流程
- ❌ **无质量评价**: QualityMetrics 生成后无评价和决策流程

### 7.3 质量不可控点

- ⚠️ **规则切分**: 章节、场景、Shot 均使用简单规则切分，质量不可控
- ⚠️ **信息提取**: 摘要、地点、角色提取准确率低
- ✅ **质量指标**: CE03/CE04 质量指标可量化，但需验证是否真实调用

---

**审计结论**: ⚠️ **基础链路完整，但质量链路和审核流程缺失**

