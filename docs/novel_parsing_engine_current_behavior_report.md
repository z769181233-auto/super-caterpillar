# 小说分析引擎当前行为与逻辑与报告 (Novel Parsing Engine Behavior Report)

**生成日期**: 2025-12-18
**模式**: RESEARCH
**分析对象**: Super Caterpillar Novels Analysis Engine (Current Implementation)

## 1. 入口定位 (Entry Point Map)

### API 层 (Entry)

- **Controller**: `apps/api/src/novel-import/novel-import.controller.ts`
  - `POST /import-file`: 接收文件 -> `FileParserService` 解析 -> 创建 `NovelAnalysisJob` (PENDING) -> 创建 Task。
  - `POST /analyze`: 触发分析 -> 创建/更新 `NovelAnalysisJob` -> 触发 Worker。

### 核心处理层 (Core Logic)

- **Worker**: `apps/workers/src/novel-analysis-processor.ts` (核心逻辑所在)
  - `basicTextSegmentation(rawText, projectId)`: **真实引擎入口**。负责将文本拆解为结构化数据。
  - `validateAnalyzedStructure()`: 结构校验。
  - `applyAnalyzedStructureToDatabase()`: 结果入库。

### 服务层 (Service / Helper)

- **API Service**: `apps/api/src/novel-import/novel-analysis-processor.service.ts`
  - `analyzeChapter()`: 单章分析简单逻辑 (Fallback/Test use)。
  - `extractLocation()`: 简单的正则地点提取。

调用链：

```text
[API] NovelImportController
    └─> [DB] Create NovelAnalysisJob (PENDING)
            └─> [Worker] (Async Job Processor)
                    └─> [Function] basicTextSegmentation (Pure Logic)
                            └─> Parse Seasons (Regex)
                            └─> Parse Episodes (Regex)
                            └─> Parse Scenes (Empty Line)
                            └─> Parse Shots (Punctuation)
                    └─> [Function] applyAnalyzedStructureToDatabase
                            └─> [DB] Write Season/Episode/Scene/Shot Tables
```

## 2. 实际分析内容清单 (Actual Analysis Output)

以下为代码 `basicTextSegmentation` 实际生成的字段结构：

### 实体结构 (Entities)

- **Season** (季)
  - `index`: 整数 (自动递增)
  - `title`: 字符串 (正则提取 "第X季", 默认 "第 1 季")
  - `summary`: 空字符串 (无生成逻辑)
- **Episode** (集)
  - `index`: 整数 (自动递增)
  - `title`: 字符串 (正则提取 "第X章/回/集", 默认 "第 1 集")
  - `summary`: 空字符串 (无生成逻辑)
- **Scene** (场)
  - `index`: 整数 (自动递增)
  - `title`: 字符串 ("场景 X")
  - `summary`: 字符串 (截取正文前 50 字)
- **Shot** (镜头)
  - `index`: 整数 (自动递增)
  - `title`: 字符串 ("镜头 X")
  - `summary`: 字符串 (截取正文前 50 字)
  - `text`: 字符串 (完整句子，存入 `params.sourceText` 和 `description`)

### 缺失字段 (Missing)

- **人物 (Characters)**: 无。代码中 `characters: []`。
- **事件 (Events)**: 无。
- **时间 (Time)**: 无。
- **视觉密度 (Visual Density)**: 无。
- **视觉补全 (Visual Completion)**: 无。
- **润色状态**: 无。

## 3. 对齐核验表 (Alignment Verification)

| 讨论点            | 代码是否存在 | 证据 (File:Function)                                         | 与文档是否一致          | 风险                                                                               |
| :---------------- | :----------- | :----------------------------------------------------------- | :---------------------- | :--------------------------------------------------------------------------------- |
| **结构拆解**      | 是           | `novel-analysis-processor.ts : basicTextSegmentation`        | **不一致** (过于简陋)   | 仅实现了物理分段，无语义理解。场景/镜头划分完全依赖格式（空行/标点），缺乏叙事性。 |
| **自动补全/润色** | **否**       | 全文无 LLM 调用，无 enrichment 逻辑                          | **一致** (代码确实没写) | 缺乏 AI 能力，输出结果仅为文本切片，无法直接用于分镜生成。                         |
| **人物/场景提取** | **否**       | `novel-analysis-processor.service.ts` 中 `characters` 恒为空 | **不一致**              | 下游引擎将无法获取角色列表。                                                       |
| **镜头划分规则**  | 是 (硬规则)  | `split(/(?<=[。！？!?])/)`                                   | **一致** (作为兜底)     | 镜头过碎（一句话一个镜头），缺乏画面感聚合。                                       |
| **数据输出**      | 是           | `applyAnalyzedStructureToDatabase`                           | **一致**                | 能够正确写入 DB，为后续 Stage 预留了 ID 关联。                                     |

## 4. 描述不清的处理机制

- **当前机制**: **无** (不会做任何补全或润色)。
- **现状**:
  - 所有 `summary` 均直接截取原文前 50-100 字。
  - 没有 `enriched` 标记。
  - 没有调用任何 LLM 接口。
- **缺口**: 任何描述不清的文本（如“他很生气”）将原样透传给下游，导致分镜引擎无法生成具体画面。

## 5. 季/集/场/镜头划分规则 (Current Rules)

所有规则均为 **硬编码正则/字符串规则**：

1.  **Season (季)**
    - **判定**: 行内容匹配正则 `/第\s*([0-9Xx]+)\s*(季|卷|部)/`。
    - **默认**: 若全文无匹配，整书归为 "第 1 季"。

2.  **Episode (集)**
    - **判定**: 行内容匹配正则 `/第\s*([0-9Xx]+)\s*(章|回|集)/`。
    - **默认**: 若无匹配，归为 "第 1 集"。

3.  **Scene (场)**
    - **判定**: **空行** (`\n\s*\n+`)。遇到空行强制结束当前场，开始新场。
    - **fallback**: 如果没有空行，或者在 `analyzeChapter` 中，按段落数硬切 (例如每 3 段一切)。

4.  **Shot (镜头)**
    - **判定**: **标点符号**。按 `。！？!?` 进行 Split。
    - **结果**: 每一句话（甚至短句）都被生成为一个独立的 Shot。

## 6. 结论：是否与讨论一致

**结论**: **不完全一致，处于非常早期的 "Stub/MVP" 状态**。

1.  **结构拆解**：仅完成了**物理层面的文本切片**（Text Slicing），完全没有进行**语义层面的结构化**（Semantic Structuring）。
2.  **缺失核心能力**：目前代码只是一个 "File Splitter"（文件切割器），而不是 "Analysis Engine"（分析引擎）。它没有能力识别人物、地点、时间或事件。
3.  **后续影响**：当前的输出如果不经处理直接送入 Stage 2/3/4，后续引擎将无法工作（因为缺少 prompt 必要的结构化信息）。

建议：

- Stage 1 Close 虽不包含 Engine 实现，但需明确认知**当前 Engine 不可用**。
- Stage 3 (Core Engine) 启动时，必须完全重写 `basicTextSegmentation`，引入 LLM 或更高级的 NLP 逻辑。

---

**REPORT END**
