# Stage4 规划文档（v1.0 草案）

**生成时间**: 2025-12-11  
**文档版本**: v1.0  
**状态**: 📋 规划阶段（RESEARCH + PLAN）

---

## 重要声明

**本计划严格遵守 Stage1、Stage2、Stage3 的冻结范围，所有改动以"新增"为主，不破坏已有结构**。

- ✅ 不修改 `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Stage1 已封板的 Schema
- ✅ 不修改 Stage1 已确认的审计日志逻辑
- ✅ 不修改 Stage2 已实现的 Engine Hub 核心架构（EngineRegistryHub、EngineInvokerHub）
- ✅ 不修改 Stage3 已实现的结构树构造器和 NovelAnalysis 流程
- ✅ 不修改 Orchestrator / Worker 主流程的总体结构（调度算法保持不变）
- ✅ 不改动已有 HMAC / Nonce / 签名 / 重放防护逻辑

**允许范围**：
- ✅ 在 Engine Hub 中新增引擎类型（语义增强、镜头规划、质量评估）
- ✅ 在现有模型上新增可选字段（不破坏 Stage1 Schema）
- ✅ 新增独立的增强数据表（如 `SemanticEnhancement`、`ShotPlanning`）
- ✅ 新增只读 API 和写入 API（不破坏现有接口）
- ✅ 在 Studio 前端新增组件和页面区域

---

## 1. 目标与范围

### 目标

在已经稳定的 Project → Season → Episode → Scene → Shot 结构树之上，规划并设计一整套"内容增强 + 生产辅助"的引擎与前端能力，为后续镜头生产与多引擎协作打基础。

### 内容

**核心能力**：

1. **语义增强引擎（S4-A）**：对 Episode / Scene / Shot 生成和维护摘要、关键词、角色、情绪、节奏等语义信息
2. **镜头规划引擎（S4-B）**：基于 Scene / Shot 文本与语义标签，给出镜头类型、运动方式、构图建议
3. **结构质量评估与校验（S4-C）**：定义结构质量指标，给出评分和问题列表
4. **Studio 前端增强（S4-D）**：在 Studio 中展示语义信息、镜头建议、质量提示

### 关键结果

- ✅ 语义增强引擎通过 Engine Hub 统一调用，生成和维护 Episode/Scene/Shot 的语义信息
- ✅ 镜头规划引擎提供镜头类型、运动方式、构图建议，结果可展示
- ✅ 结构质量评估系统能够检测和报告结构问题
- ✅ Studio 前端能够展示语义信息、镜头建议和质量提示
- ✅ 所有新引擎遵循 Engine Hub 架构，不破坏 Stage1/2/3 冻结内容

---

## 2. 现状与基础（引用 Stage1~3 能力）

### 2.1 Stage1 基础能力

**已冻结的 Schema**：
- `Task`、`AuditLog`、`NovelChapter`、`Scene.projectId` 等核心模型
- 审计日志逻辑和 HMAC/Nonce 安全链路

**可复用的能力**：
- 任务系统（Task/Job 体系）
- 审计日志系统（AuditLogService）
- 用户权限系统

### 2.2 Stage2 Engine Hub 架构

**已实现的组件**：
- `EngineRegistryHubService`：引擎注册表，维护引擎配置清单
- `EngineInvokerHubService`：统一引擎调用服务，接收 `EngineInvocationRequest`，返回 `EngineInvocationResult`
- `EngineInvocationRequest<TInput>` / `EngineInvocationResult<TOutput>`：标准调用接口

**可复用的能力**：
- 引擎注册机制（`register()`、`find()`）
- 统一调用接口（`invoke<TInput, TOutput>()`）
- Local/HTTP Adapter 模式

### 2.3 Stage3 结构树能力

**已实现的功能**：
- `NOVEL_ANALYSIS` 引擎：从小说文本生成 Project → Season → Episode → Scene → Shot 结构树
- `ProjectStructureTree` API：`GET /api/projects/:projectId/structure`
- Studio 前端结构树展示组件（`ProjectStructureTree`）

**可复用的能力**：
- 结构树构造器（`applyAnalyzedStructureToDatabase`）
- 结构验证函数（`validateAnalyzedStructure`）
- 前端结构树展示组件

### 2.4 现有数据结构基础

**Episode 模型**（已有字段）：
- `summary String?`：摘要（已有）
- 可扩展：语义增强字段（通过新增表或 JSON 字段）

**Scene 模型**（已有字段）：
- `summary String?`：摘要（已有）
- `characters Json?`：角色 ID 列表（已有，V1.1）
- `visualDensityScore Float?`：视觉密度评分（已有，V1.1）
- `enrichedText String? @db.Text`：文本增强结果（已有，V1.1）
- 可扩展：情绪、节奏、关键词等（通过新增表或 JSON 字段）

**Shot 模型**（已有字段）：
- `description String?`：描述（已有）
- `enrichedPrompt String? @db.Text`：文本增强后的镜头 prompt（已有，V1.1）
- `params Json`：引擎参数（已有）
- 可扩展：镜头类型、运动方式、构图建议（通过新增表或 JSON 字段）

---

## 3. S4-A：语义增强引擎

### 目标

对 Episode / Scene / Shot 生成和维护语义信息，包括摘要、关键词、角色、情绪、节奏等，全部通过 Engine Hub 调用独立引擎完成。

### 内容

**核心能力**：

1. **摘要生成与维护**：
   - 对 Episode / Scene / Shot 生成摘要（`summary`）
   - 支持增量更新（当文本变化时重新生成）

2. **关键词 / Tag 提取**：
   - 提取关键词列表（如：["战斗", "悬疑", "情感"]）
   - 支持自定义 Tag 和自动 Tag

3. **角色出场信息**：
   - 识别场景中出现的角色
   - 记录角色的情感状态、动作、对话

4. **情绪 / 氛围分析**：
   - 识别场景的情绪（如：紧张、轻松、悲伤）
   - 分析氛围（如：悬疑、浪漫、动作）

5. **节奏 / 节点类型**：
   - 识别节奏类型（起承转合等）
   - 标记关键节点（转折点、高潮、结尾等）

**引擎设计**：

- **引擎 Key**: `semantic_enhancement`
- **输入**: `SemanticEnhancementEngineInput`
- **输出**: `SemanticEnhancementEngineOutput`

**数据存储策略**：

- **方案 A（推荐）**：新增 `SemanticEnhancement` 表，关联到 Episode/Scene/Shot
- **方案 B**：在现有模型的 `params` JSON 字段中存储语义信息

### 关键结果

- ✅ 语义增强引擎已注册到 Engine Hub
- ✅ 支持对 Episode/Scene/Shot 进行语义增强
- ✅ 语义信息可持久化存储和查询
- ✅ 支持增量更新和批量处理

---

## 4. S4-B：镜头规划引擎（Shot Planning）

### 目标

基于 Scene / Shot 文本与语义标签，给出镜头类型、运动方式、构图建议，结果写入专门的存储，前端可以只读展示。

### 内容

**核心能力**：

1. **镜头类型建议**：
   - 远景（Wide Shot）
   - 中景（Medium Shot）
   - 特写（Close-up）
   - 超特写（Extreme Close-up）
   - 全景（Full Shot）
   - 等

2. **运动方式建议**：
   - 推（Dolly In）
   - 拉（Dolly Out）
   - 摇（Pan）
   - 移（Truck）
   - 跟（Follow）
   - 升降（Crane）
   - 等

3. **构图 hint**：
   - 主体位置（中心、左侧、右侧、前景、背景）
   - 景别层次（前景、中景、背景）
   - 构图类型（对称、三分法、黄金分割等）

**引擎设计**：

- **引擎 Key**: `shot_planning`
- **输入**: `ShotPlanningEngineInput`
- **输出**: `ShotPlanningEngineOutput`

**数据存储策略**：

- **方案 A（推荐）**：新增 `ShotPlanning` 表，关联到 Shot
- **方案 B**：在 `Shot.params` JSON 字段中存储规划信息

### 关键结果

- ✅ 镜头规划引擎已注册到 Engine Hub
- ✅ 支持基于文本和语义标签生成镜头建议
- ✅ 规划结果可持久化存储和查询
- ✅ 前端可以只读展示镜头建议

---

## 5. S4-C：结构质量评估与校验（Structure QA）

### 目标

定义一套结构质量指标，检测结构问题，给出评分和问题列表，用于后续 Studio 内的"质量提示"。

### 内容

**核心能力**：

1. **质量指标定义**：
   - **孤儿节点检测**：是否存在无父节点的 Episode/Scene/Shot
   - **断层 Episode 检测**：是否存在 index 不连续的 Episode
   - **空 Scene 检测**：是否存在没有 Shot 的 Scene
   - **内容完整性检测**：是否存在无正文的节点（title/summary/text 都为空）
   - **章节长度分布异常检测**：Episode/Scene/Shot 长度是否极端异常（过长或过短）

2. **评分系统**：
   - 整体质量评分（0-1）
   - 各维度评分（完整性、连续性、合理性等）
   - 问题严重程度（Critical、Warning、Info）

3. **问题列表生成**：
   - 列出所有检测到的问题
   - 每个问题包含：类型、位置、严重程度、建议修复方案

**引擎设计**：

- **引擎 Key**: `structure_qa`
- **输入**: `StructureQAEngineInput`
- **输出**: `StructureQAEngineOutput`

**数据存储策略**：

- **方案 A（推荐）**：新增 `StructureQualityReport` 表，关联到 Project
- **方案 B**：在 `Project` 模型的 `params` JSON 字段中存储质量报告

### 关键结果

- ✅ 结构质量评估引擎已注册到 Engine Hub
- ✅ 支持检测和报告结构问题
- ✅ 质量报告可持久化存储和查询
- ✅ 前端可以展示质量提示面板

---

## 6. S4-D：Studio 前端增强

### 目标

基于现有 `ProjectStructureTree`，在 Studio 中增加语义信息、镜头建议、质量提示的可视化展示。

### 内容

**核心能力**：

1. **Episode / Scene / Shot 摘要预览栏**：
   - 在节点详情面板中显示摘要
   - 支持展开/折叠
   - 支持编辑（如果用户有权限）

2. **Tag / 情绪 / 节奏标记的可视化**：
   - Tag 标签展示（彩色标签）
   - 情绪图标（emoji 或图标）
   - 节奏标记（时间轴或节点图）

3. **简化版的镜头建议展示（只读）**：
   - 镜头类型图标
   - 运动方式图标
   - 构图 hint 文字描述

4. **质量提示面板**：
   - 列出结构问题
   - 问题严重程度颜色标识
   - 点击问题可跳转到对应节点

**组件设计**：

- `SemanticInfoPanel.tsx`：语义信息展示面板
- `ShotPlanningPanel.tsx`：镜头建议展示面板
- `QualityHintPanel.tsx`：质量提示面板
- `TagBadge.tsx`：Tag 标签组件
- `EmotionBadge.tsx`：情绪标记组件

### 关键结果

- ✅ 摘要预览栏已集成到节点详情面板
- ✅ Tag/情绪/节奏标记已可视化展示
- ✅ 镜头建议已展示（只读）
- ✅ 质量提示面板已集成到 Studio

---

## 7. 引擎侧规划（Engine Hub 需要新增的引擎类型和 DTO）

### 目标

为 S4-A/B/C 三个新引擎定义统一的 Engine Hub 接口和 DTO，确保符合 Stage2 架构。

### 内容

#### 7.1 S4-A：语义增强引擎 DTO

**文件**: `packages/shared-types/src/engines/semantic-enhancement.dto.ts`

```typescript
/**
 * S4-A: 语义增强引擎输入
 */
export interface SemanticEnhancementEngineInput {
  /**
   * 目标节点类型
   */
  nodeType: 'episode' | 'scene' | 'shot';
  
  /**
   * 节点 ID
   */
  nodeId: string;
  
  /**
   * 节点文本内容
   */
  text: string;
  
  /**
   * 上下文信息（可选）
   */
  context?: {
    projectId?: string;
    seasonId?: string;
    episodeId?: string;
    sceneId?: string;
    parentSummary?: string;
    [key: string]: unknown;
  };
  
  /**
   * 增强选项
   */
  options?: {
    /**
     * 是否生成摘要
     */
    generateSummary?: boolean;
    
    /**
     * 是否提取关键词
     */
    extractKeywords?: boolean;
    
    /**
     * 是否识别角色
     */
    identifyCharacters?: boolean;
    
    /**
     * 是否分析情绪
     */
    analyzeEmotion?: boolean;
    
    /**
     * 是否分析节奏
     */
    analyzeRhythm?: boolean;
    
    [key: string]: unknown;
  };
}

/**
 * S4-A: 语义增强引擎输出
 */
export interface SemanticEnhancementEngineOutput {
  /**
   * 摘要
   */
  summary?: string;
  
  /**
   * 关键词列表
   */
  keywords?: string[];
  
  /**
   * 角色信息
   */
  characters?: Array<{
    name: string;
    role?: string;
    emotion?: string;
    action?: string;
    dialogue?: string;
  }>;
  
  /**
   * 情绪分析
   */
  emotion?: {
    primary: string; // 主要情绪
    secondary?: string[]; // 次要情绪
    intensity: number; // 强度（0-1）
  };
  
  /**
   * 氛围分析
   */
  atmosphere?: string[];
  
  /**
   * 节奏分析
   */
  rhythm?: {
    type: '起' | '承' | '转' | '合' | '高潮' | '结尾' | '其他';
    intensity: number; // 强度（0-1）
    pace: 'slow' | 'medium' | 'fast'; // 节奏速度
  };
  
  /**
   * 置信度（0-1）
   */
  confidence?: number;
}
```

#### 7.2 S4-B：镜头规划引擎 DTO

**文件**: `packages/shared-types/src/engines/shot-planning.dto.ts`

```typescript
/**
 * S4-B: 镜头规划引擎输入
 */
export interface ShotPlanningEngineInput {
  /**
   * Shot ID
   */
  shotId: string;
  
  /**
   * Shot 文本内容
   */
  text: string;
  
  /**
   * 语义信息（可选，如果已有语义增强结果）
   */
  semanticInfo?: {
    summary?: string;
    keywords?: string[];
    emotion?: {
      primary: string;
      intensity: number;
    };
    characters?: Array<{
      name: string;
      role?: string;
    }>;
  };
  
  /**
   * 上下文信息
   */
  context?: {
    projectId?: string;
    sceneId?: string;
    sceneSummary?: string;
    previousShotType?: string;
    [key: string]: unknown;
  };
  
  /**
   * 规划选项
   */
  options?: {
    /**
     * 是否建议镜头类型
     */
    suggestShotType?: boolean;
    
    /**
     * 是否建议运动方式
     */
    suggestMovement?: boolean;
    
    /**
     * 是否建议构图
     */
    suggestComposition?: boolean;
    
    [key: string]: unknown;
  };
}

/**
 * S4-B: 镜头规划引擎输出
 */
export interface ShotPlanningEngineOutput {
  /**
   * 镜头类型建议
   */
  shotType?: {
    primary: 'wide' | 'medium' | 'close-up' | 'extreme-close-up' | 'full' | 'other';
    alternatives?: string[];
    confidence: number;
  };
  
  /**
   * 运动方式建议
   */
  movement?: {
    primary: 'dolly-in' | 'dolly-out' | 'pan' | 'truck' | 'follow' | 'crane' | 'static' | 'other';
    alternatives?: string[];
    confidence: number;
  };
  
  /**
   * 构图建议
   */
  composition?: {
    /**
     * 主体位置
     */
    subjectPosition?: 'center' | 'left' | 'right' | 'foreground' | 'background';
    
    /**
     * 景别层次
     */
    depthLayers?: {
      foreground?: string;
      midground?: string;
      background?: string;
    };
    
    /**
     * 构图类型
     */
    compositionType?: 'symmetrical' | 'rule-of-thirds' | 'golden-ratio' | 'other';
    
    /**
     * 构图描述
     */
    description?: string;
  };
  
  /**
   * 置信度（0-1）
   */
  confidence?: number;
}
```

#### 7.3 S4-C：结构质量评估引擎 DTO

**文件**: `packages/shared-types/src/engines/structure-qa.dto.ts`

```typescript
/**
 * S4-C: 结构质量评估引擎输入
 */
export interface StructureQAEngineInput {
  /**
   * 项目 ID
   */
  projectId: string;
  
  /**
   * 评估选项
   */
  options?: {
    /**
     * 是否检测孤儿节点
     */
    checkOrphanNodes?: boolean;
    
    /**
     * 是否检测断层 Episode
     */
    checkEpisodeContinuity?: boolean;
    
    /**
     * 是否检测空 Scene
     */
    checkEmptyScenes?: boolean;
    
    /**
     * 是否检测内容完整性
     */
    checkContentIntegrity?: boolean;
    
    /**
     * 是否检测长度分布异常
     */
    checkLengthDistribution?: boolean;
    
    [key: string]: unknown;
  };
}

/**
 * S4-C: 结构质量评估引擎输出
 */
export interface StructureQAEngineOutput {
  /**
   * 整体质量评分（0-1）
   */
  overallScore: number;
  
  /**
   * 各维度评分
   */
  dimensionScores?: {
    integrity: number; // 完整性（0-1）
    continuity: number; // 连续性（0-1）
    reasonableness: number; // 合理性（0-1）
  };
  
  /**
   * 问题列表
   */
  issues: Array<{
    /**
     * 问题类型
     */
    type: 'orphan-node' | 'episode-discontinuity' | 'empty-scene' | 'missing-content' | 'length-anomaly' | 'other';
    
    /**
     * 严重程度
     */
    severity: 'critical' | 'warning' | 'info';
    
    /**
     * 问题位置
     */
    location: {
      nodeType: 'episode' | 'scene' | 'shot';
      nodeId: string;
      nodeIndex?: number;
      [key: string]: unknown;
    };
    
    /**
     * 问题描述
     */
    description: string;
    
    /**
     * 建议修复方案
     */
    suggestion?: string;
  }>;
  
  /**
   * 统计信息
   */
  stats?: {
    totalNodes: number;
    orphanNodes: number;
    emptyScenes: number;
    missingContentNodes: number;
    [key: string]: number;
  };
}
```

#### 7.4 引擎注册

**文件**: `apps/api/src/engine-hub/engine-registry-hub.service.ts`

需要在 `engines` 数组中注册新引擎：

```typescript
private engines: EngineDescriptor[] = [
  // Stage2: NOVEL_ANALYSIS
  {
    key: 'novel_analysis',
    version: 'default',
    mode: 'local',
    adapterToken: 'NovelAnalysisLocalAdapter',
  },
  // Stage4: 新增引擎
  {
    key: 'semantic_enhancement',
    version: 'default',
    mode: 'local', // 或 'http'
    adapterToken: 'SemanticEnhancementLocalAdapter',
  },
  {
    key: 'shot_planning',
    version: 'default',
    mode: 'local', // 或 'http'
    adapterToken: 'ShotPlanningLocalAdapter',
  },
  {
    key: 'structure_qa',
    version: 'default',
    mode: 'local', // 或 'http'
    adapterToken: 'StructureQALocalAdapter',
  },
];
```

### 关键结果

- ✅ 三个新引擎的 DTO 已定义并导出
- ✅ 引擎已注册到 Engine Hub
- ✅ 符合 Stage2 Engine Hub 架构规范

---

## 8. 数据侧规划（需要新增/扩展的字段与 DTO）

### 目标

在严格遵守 Stage1 Schema 冻结的前提下，通过新增表或扩展 JSON 字段的方式存储语义增强、镜头规划、质量评估数据。

### 内容

#### 8.1 方案选择

**原则**：
- 不修改 Stage1 冻结的 Schema（Task、AuditLog、NovelChapter、Scene.projectId 等）
- 优先使用新增表，避免在现有模型的必填字段上做修改
- 如需扩展现有模型，仅添加可选字段（`String?`、`Json?`）

#### 8.2 新增数据表设计

**表 1: SemanticEnhancement（语义增强表）**

```prisma
model SemanticEnhancement {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 关联到目标节点（多态关联）
  nodeType    String   // 'episode' | 'scene' | 'shot'
  nodeId      String   // Episode/Scene/Shot ID
  
  // 语义信息（JSON 存储）
  data        Json     // SemanticEnhancementEngineOutput 的完整数据
  
  // 元数据
  engineKey   String   // 使用的引擎标识
  engineVersion String? // 引擎版本
  confidence  Float?   // 置信度（0-1）
  
  // 索引
  @@unique([nodeType, nodeId])
  @@index([nodeType, nodeId])
  @@map("semantic_enhancements")
}
```

**表 2: ShotPlanning（镜头规划表）**

```prisma
model ShotPlanning {
  id          String   @id @default(uuid())
  shotId      String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 规划信息（JSON 存储）
  data        Json     // ShotPlanningEngineOutput 的完整数据
  
  // 元数据
  engineKey   String   // 使用的引擎标识
  engineVersion String? // 引擎版本
  confidence  Float?   // 置信度（0-1）
  
  // 关联到 Shot
  shot        Shot     @relation("ShotPlanning", fields: [shotId], references: [id], onDelete: Cascade)
  
  @@map("shot_plannings")
}
```

**表 3: StructureQualityReport（结构质量报告表）**

```prisma
model StructureQualityReport {
  id          String   @id @default(uuid())
  projectId  String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 质量报告（JSON 存储）
  data        Json     // StructureQAEngineOutput 的完整数据
  
  // 元数据
  engineKey   String   // 使用的引擎标识
  engineVersion String? // 引擎版本
  
  // 关联到 Project
  project     Project  @relation("ProjectQualityReport", fields: [projectId], references: [id], onDelete: Cascade)
  
  @@map("structure_quality_reports")
}
```

#### 8.3 现有模型扩展（可选字段）

**Scene 模型扩展**（如果不想新增表）：

```prisma
model Scene {
  // ... 现有字段 ...
  
  // S4-A: 语义增强信息（可选，通过 JSON 存储）
  semanticEnhancement Json? // SemanticEnhancementEngineOutput
  
  // S4-C: 质量标记（可选）
  qualityFlags Json? // { hasIssues: boolean, issueTypes: string[] }
}
```

**Shot 模型扩展**（如果不想新增表）：

```prisma
model Shot {
  // ... 现有字段 ...
  
  // S4-B: 镜头规划信息（可选，通过 JSON 存储）
  shotPlanning Json? // ShotPlanningEngineOutput
  
  // S4-A: 语义增强信息（可选）
  semanticEnhancement Json? // SemanticEnhancementEngineOutput
}
```

**Project 模型扩展**（如果不想新增表）：

```prisma
model Project {
  // ... 现有字段 ...
  
  // S4-C: 质量报告（可选，通过 JSON 存储）
  qualityReport Json? // StructureQAEngineOutput
}
```

#### 8.4 推荐方案

**推荐使用新增表方案**，原因：
1. 不修改 Stage1 冻结的 Schema
2. 数据更清晰，便于查询和索引
3. 支持版本管理和历史记录
4. 便于后续扩展

### 关键结果

- ✅ 新增数据表设计完成（SemanticEnhancement、ShotPlanning、StructureQualityReport）
- ✅ 符合 Stage1 Schema 冻结约束
- ✅ 支持数据查询和索引

---

## 9. API 规划（新增查询/写入接口的列表）

### 目标

新增只读和写入 API，不破坏现有接口，确保前后端数据契约一致。

### 内容

#### 9.1 S4-A：语义增强 API

**写入接口**：

- `POST /api/projects/:projectId/episodes/:episodeId/semantic-enhancement`
  - 对指定 Episode 进行语义增强
  - 请求体：`{ options?: SemanticEnhancementEngineInput['options'] }`
  - 返回：`{ success: boolean, data: SemanticEnhancementEngineOutput }`

- `POST /api/projects/:projectId/scenes/:sceneId/semantic-enhancement`
  - 对指定 Scene 进行语义增强
  - 请求体：`{ options?: SemanticEnhancementEngineInput['options'] }`
  - 返回：`{ success: boolean, data: SemanticEnhancementEngineOutput }`

- `POST /api/projects/:projectId/shots/:shotId/semantic-enhancement`
  - 对指定 Shot 进行语义增强
  - 请求体：`{ options?: SemanticEnhancementEngineInput['options'] }`
  - 返回：`{ success: boolean, data: SemanticEnhancementEngineOutput }`

**批量写入接口**：

- `POST /api/projects/:projectId/semantic-enhancement/batch`
  - 批量对多个节点进行语义增强
  - 请求体：`{ nodeIds: Array<{ nodeType: string, nodeId: string }>, options?: ... }`
  - 返回：`{ success: boolean, data: Array<{ nodeId: string, result: SemanticEnhancementEngineOutput }> }`

**查询接口**：

- `GET /api/projects/:projectId/episodes/:episodeId/semantic-enhancement`
  - 获取指定 Episode 的语义增强信息
  - 返回：`{ success: boolean, data: SemanticEnhancementEngineOutput | null }`

- `GET /api/projects/:projectId/scenes/:sceneId/semantic-enhancement`
  - 获取指定 Scene 的语义增强信息
  - 返回：`{ success: boolean, data: SemanticEnhancementEngineOutput | null }`

- `GET /api/projects/:projectId/shots/:shotId/semantic-enhancement`
  - 获取指定 Shot 的语义增强信息
  - 返回：`{ success: boolean, data: SemanticEnhancementEngineOutput | null }`

#### 9.2 S4-B：镜头规划 API

**写入接口**：

- `POST /api/projects/:projectId/shots/:shotId/shot-planning`
  - 对指定 Shot 进行镜头规划
  - 请求体：`{ options?: ShotPlanningEngineInput['options'] }`
  - 返回：`{ success: boolean, data: ShotPlanningEngineOutput }`

**批量写入接口**：

- `POST /api/projects/:projectId/scenes/:sceneId/shots/shot-planning/batch`
  - 批量对 Scene 下的所有 Shot 进行镜头规划
  - 请求体：`{ options?: ... }`
  - 返回：`{ success: boolean, data: Array<{ shotId: string, result: ShotPlanningEngineOutput }> }`

**查询接口**：

- `GET /api/projects/:projectId/shots/:shotId/shot-planning`
  - 获取指定 Shot 的镜头规划信息
  - 返回：`{ success: boolean, data: ShotPlanningEngineOutput | null }`

#### 9.3 S4-C：结构质量评估 API

**写入接口**：

- `POST /api/projects/:projectId/structure-quality/assess`
  - 对指定 Project 进行结构质量评估
  - 请求体：`{ options?: StructureQAEngineInput['options'] }`
  - 返回：`{ success: boolean, data: StructureQAEngineOutput }`

**查询接口**：

- `GET /api/projects/:projectId/structure-quality/report`
  - 获取指定 Project 的最新质量报告
  - 返回：`{ success: boolean, data: StructureQAEngineOutput | null }`

#### 9.4 API 安全与权限

**安全机制**：
- 所有 API 使用现有的 `JwtAuthGuard` 和 `PermissionsGuard`
- 写入接口需要 `PROJECT_GENERATE` 权限
- 查询接口需要 `PROJECT_READ` 权限

**审计日志**：
- 写入接口记录审计日志（使用现有的 `AuditInterceptor`）
- 审计动作：`SEMANTIC_ENHANCEMENT_CREATE`、`SHOT_PLANNING_CREATE`、`STRUCTURE_QA_ASSESS`

### 关键结果

- ✅ 所有新 API 已定义（写入和查询接口）
- ✅ 符合现有 API 安全规范
- ✅ 不破坏现有接口

---

## 10. Studio 侧规划（要新增的组件、页面区域、交互说明）

### 目标

在 Studio 前端中新增语义信息、镜头建议、质量提示的可视化展示，与现有 `ProjectStructureTree` 集成。

### 内容

#### 10.1 新增组件列表

**组件 1: SemanticInfoPanel.tsx**

**位置**: `apps/web/src/components/studio/SemanticInfoPanel.tsx`

**功能**：
- 展示 Episode/Scene/Shot 的语义信息
- 包括：摘要、关键词、角色、情绪、节奏
- 支持展开/折叠
- 支持编辑（如果用户有权限）

**Props**:
```typescript
interface SemanticInfoPanelProps {
  nodeType: 'episode' | 'scene' | 'shot';
  nodeId: string;
  projectId: string;
  readOnly?: boolean;
}
```

**组件 2: ShotPlanningPanel.tsx**

**位置**: `apps/web/src/components/studio/ShotPlanningPanel.tsx`

**功能**：
- 展示 Shot 的镜头规划建议
- 包括：镜头类型、运动方式、构图 hint
- 只读展示（MVP 阶段）

**Props**:
```typescript
interface ShotPlanningPanelProps {
  shotId: string;
  projectId: string;
}
```

**组件 3: QualityHintPanel.tsx**

**位置**: `apps/web/src/components/studio/QualityHintPanel.tsx`

**功能**：
- 展示结构质量报告
- 列出所有问题（按严重程度排序）
- 点击问题可跳转到对应节点

**Props**:
```typescript
interface QualityHintPanelProps {
  projectId: string;
}
```

**组件 4: TagBadge.tsx**

**位置**: `apps/web/src/components/studio/TagBadge.tsx`

**功能**：
- 展示 Tag 标签（彩色标签）
- 支持点击筛选

**组件 5: EmotionBadge.tsx**

**位置**: `apps/web/src/components/studio/EmotionBadge.tsx`

**功能**：
- 展示情绪标记（emoji 或图标）
- 支持强度显示

#### 10.2 页面集成方案

**集成位置 1: 项目主页面（`/projects/[projectId]`）**

- 在右侧详情面板（`DetailPanel`）中集成 `SemanticInfoPanel`
- 当选中 Episode/Scene/Shot 时，显示对应的语义信息
- 在底部添加 `QualityHintPanel`（可折叠）

**集成位置 2: 结构树组件（`ProjectStructureTree`）**

- 在节点标题旁显示 Tag 和情绪图标
- 点击节点时，在详情面板中显示完整语义信息

**集成位置 3: Shot 详情页（如果存在）**

- 集成 `ShotPlanningPanel`，展示镜头规划建议

#### 10.3 交互说明

**语义信息展示**：
- 默认折叠，点击展开
- Tag 支持点击筛选（高亮包含该 Tag 的节点）
- 情绪图标支持 hover 显示详细信息

**镜头建议展示**：
- 只读展示，不支持编辑（MVP 阶段）
- 支持图标和文字描述两种展示方式

**质量提示**：
- 默认折叠，有严重问题时自动展开
- 问题列表支持按严重程度排序
- 点击问题可跳转到对应节点并高亮

### 关键结果

- ✅ 所有新组件已定义
- ✅ 页面集成方案已明确
- ✅ 交互说明已文档化

---

## 11. 风险与不做的事情（明确 Stage4 不做哪些"超纲"功能）

### 目标

明确 Stage4 的边界，避免范围蔓延，确保聚焦核心能力。

### 内容

#### 11.1 不做的事情

1. **不修改 Stage1/2/3 冻结内容**：
   - 不修改 `Task` / `AuditLog` / `NovelChapter` / `Scene.projectId` 等 Schema
   - 不修改 Stage1 审计日志逻辑
   - 不修改 Stage2 Engine Hub 核心架构
   - 不修改 Stage3 结构树构造器和 NovelAnalysis 流程

2. **不实现复杂功能**：
   - 不实现语义信息的自动同步和冲突解决（留给后续 Stage）
   - 不实现镜头规划的自动优化和调参（留给后续 Stage）
   - 不实现质量问题的自动修复（只检测和报告，不自动修复）

3. **不修改调度算法**：
   - 不修改 Orchestrator 的任务派发逻辑
   - 不修改 Worker 的任务执行流程
   - 不修改 Job 重试机制

4. **不实现编辑功能（MVP 阶段）**：
   - 镜头建议只读展示，不支持用户编辑
   - 语义信息支持查看，编辑功能为可选（MVP 阶段可不实现）

5. **不实现实时协作**：
   - 不实现多用户实时编辑语义信息
   - 不实现语义信息的版本管理（留给后续 Stage）

6. **不实现复杂可视化**：
   - 不实现复杂的时间轴可视化
   - 不实现复杂的图表展示（MVP 阶段只做基础展示）

#### 11.2 风险点

1. **性能风险**：
   - 语义增强引擎可能耗时较长（特别是批量处理）
   - **缓解措施**：使用异步处理，支持进度反馈

2. **数据一致性风险**：
   - 语义信息可能与原始文本不一致
   - **缓解措施**：记录版本和置信度，支持重新生成

3. **前端体验风险**：
   - 大量语义信息可能导致页面加载慢
   - **缓解措施**：支持按需加载，使用虚拟滚动

4. **引擎依赖风险**：
   - 新引擎可能依赖外部服务（如 LLM API）
   - **缓解措施**：支持降级策略，本地 Adapter 作为 fallback

### 关键结果

- ✅ Stage4 边界清晰，避免范围蔓延
- ✅ 风险点已识别，缓解措施已制定

---

## 12. MVP 范围与验收标准（第一轮只做哪些最小闭环）

### 目标

定义 Stage4 MVP 的最小可行产品范围，确保第一轮实现能够验证核心价值。

### 内容

#### 12.1 MVP 范围

**S4-A MVP（语义增强引擎）**：

- ✅ 实现 `semantic_enhancement` 引擎（Local Adapter，基础实现）
- ✅ 支持对 Scene 进行语义增强（Episode 和 Shot 为可选）
- ✅ 生成摘要和关键词（角色、情绪、节奏为可选）
- ✅ 新增 `SemanticEnhancement` 表存储语义信息
- ✅ 提供写入和查询 API
- ✅ 前端展示摘要和关键词（Tag 展示）

**S4-B MVP（镜头规划引擎）**：

- ✅ 实现 `shot_planning` 引擎（Local Adapter，基础实现）
- ✅ 支持对 Shot 进行镜头规划
- ✅ 生成镜头类型建议（运动方式和构图建议为可选）
- ✅ 新增 `ShotPlanning` 表存储规划信息
- ✅ 提供写入和查询 API
- ✅ 前端只读展示镜头类型建议

**S4-C MVP（结构质量评估）**：

- ✅ 实现 `structure_qa` 引擎（Local Adapter，基础实现）
- ✅ 支持检测空 Scene 和内容完整性（其他检测为可选）
- ✅ 生成质量报告和问题列表
- ✅ 新增 `StructureQualityReport` 表存储报告
- ✅ 提供写入和查询 API
- ✅ 前端展示质量提示面板（列出问题）

**S4-D MVP（Studio 前端增强）**：

- ✅ 集成 `SemanticInfoPanel` 到节点详情面板
- ✅ 集成 `TagBadge` 到结构树节点
- ✅ 集成 `ShotPlanningPanel` 到 Shot 详情（如果存在）
- ✅ 集成 `QualityHintPanel` 到项目主页面

#### 12.2 验收标准

**功能验收**：

1. **语义增强闭环** ✅
   - 用户可以对 Scene 进行语义增强
   - 系统生成摘要和关键词
   - 前端可以展示语义信息

2. **镜头规划闭环** ✅
   - 用户可以对 Shot 进行镜头规划
   - 系统生成镜头类型建议
   - 前端可以展示镜头建议

3. **质量评估闭环** ✅
   - 用户可以对 Project 进行质量评估
   - 系统检测并报告结构问题
   - 前端可以展示质量提示

4. **全流程稳定** ✅
   - 语义增强 → 存储 → 查询 → 展示 链路打通
   - 镜头规划 → 存储 → 查询 → 展示 链路打通
   - 质量评估 → 存储 → 查询 → 展示 链路打通

**技术验收**：

- ✅ 所有新引擎通过 Engine Hub 统一调用
- ✅ 所有新 API 符合现有安全规范
- ✅ 所有新数据表符合 Stage1 Schema 约束
- ✅ 前端组件符合 Studio 一致性规范

**性能验收**：

- ✅ 语义增强 API 响应时间 < 5s（单节点）
- ✅ 镜头规划 API 响应时间 < 3s（单节点）
- ✅ 质量评估 API 响应时间 < 10s（整个项目）
- ✅ 前端页面加载无明显卡顿

### 关键结果

- ✅ MVP 范围已明确
- ✅ 验收标准已定义
- ✅ 第一轮实现可验证核心价值

---

## 13. 总结

### Stage4 核心价值

1. **内容增强**：通过语义增强引擎，为 Episode/Scene/Shot 生成丰富的语义信息，提升内容理解
2. **生产辅助**：通过镜头规划引擎，为 Shot 提供镜头类型、运动方式、构图建议，辅助生产决策
3. **质量保障**：通过结构质量评估，检测和报告结构问题，确保内容质量
4. **可视化展示**：在 Studio 前端展示语义信息、镜头建议、质量提示，提升用户体验

### 下一步行动

1. **EXECUTE 阶段**：根据本规划文档执行代码实现
2. **测试验证**：确保语义增强、镜头规划、质量评估链路完整可用
3. **文档完善**：补充 API 文档和使用示例

---

**文档状态**: ✅ v1.0 草案已完成，待用户确认后进入 EXECUTE 阶段

**最后更新**: 2025-12-11

---

## S4-EXECUTION-REPORT v1.0

**执行时间**: 2025-12-11  
**模式**: EXECUTE（MVP）

### 新增表（Prisma Schema）
- `SemanticEnhancement`（nodeType/nodeId 唯一，存语义结果）
- `ShotPlanning`（shotId 唯一，存镜头规划结果）
- `StructureQualityReport`（projectId 唯一，存质量报告）

> 备注：`prisma migrate dev --create-only --name stage4_semantic_shot_qa_tables` 生成需连接 DB，本地未连库，迁移文件待实际执行。

### 新增 DTO（@scu/shared-types）
- `semantic-enhancement.dto.ts`（summary, keywords）
- `shot-planning.dto.ts`（shotType.primary, movement.primary）
- `structure-qa.dto.ts`（overallScore, issues[]）

### 引擎与 Adapter（Engine Hub）
- 注册引擎：`semantic_enhancement` / `shot_planning` / `structure_qa`（mode: local）
- 本地 Stub Adapter：
  - Semantic：summary=前 100 字符，keywords=前 5 个词
  - ShotPlanning：shotType=medium，movement=static
  - StructureQA：overallScore=0.85，issues=[]

### 新增 API（MVP）
- Scene 语义增强：POST/GET `/api/projects/:projectId/scenes/:sceneId/semantic-enhancement`
- Shot 镜头规划：POST/GET `/api/projects/:projectId/shots/:shotId/shot-planning`
- Project 结构质量评估：POST/GET `/api/projects/:projectId/structure-quality/(assess|report)`
- 安全：JwtAuthGuard + PermissionsGuard；写入审计动作：`SEMANTIC_ENHANCEMENT_RUN` / `SHOT_PLANNING_RUN` / `STRUCTURE_QA_RUN`

### 前端组件与集成
- 新增组件（简化版）：`SemanticInfoPanel`、`ShotPlanningPanel`、`QualityHintPanel`
- 集成位置：`/projects/[projectId]` 右侧详情区域（Scene → SemanticInfoPanel，Shot → ShotPlanningPanel，页面顶部 QualityHintPanel）

### 构建与自检
- `@scu/worker`：build ✅
- `web`：build ✅
- `api`：待完成（依赖 Prisma 迁移，DB 未连接）
- `lint`：待执行（建议在本地完整跑一遍）

### 状态
- ✅ STAGE4_EXECUTE_MVP 已完成（代码与前端最小闭环）
- ⚠️ Prisma 迁移需连接数据库后再执行

