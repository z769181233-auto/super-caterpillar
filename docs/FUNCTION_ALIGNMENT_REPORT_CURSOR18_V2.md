# 功能对齐验证报告 V2（Cursor18）

**生成时间**: 2025-12-14  
**验证模式**: PLAN - 功能是否存在偏差验证 V2（纠正 Cursor18 报告的判定错误）  
**验证范围**: PRD / Architecture / DB / API / Engine Spec / Task / Worker / Orchestrator / 权限 / 项目结构  
**验证原则**: 严格以文档为准，任何缺失 = 阻断 FAIL

---

## 最终结论

**ALLOW_RISK_AUDIT = NO**

**理由**：存在多个阻断性 FAIL 项，不符合上线要求。详见下方详细验证结果。

---

## 一、验证方法

### 1.1 验证依据

**官方规范文档**：

1. `docs/STAGE1_OFFICIAL_SPECS_EXTRACT.md` - 包含：
   - 《毛毛虫宇宙\_数据库设计说明书\_DBSpec_V1.1》
   - 《毛毛虫宇宙\_API设计规范\_APISpec_V1.1》
   - 《毛毛虫宇宙\_内容安全与审核体系说明书\_SafetySpec_V1.1》

### 1.2 验证方法

- **存在性验证**：检查代码中是否存在文档要求的功能
- **符合性验证**：检查实现是否符合文档规范（字段、类型、行为）
- **硬规则**：
  - 任何 DB 字段名/实体缺失/索引缺失 = 阻断 FAIL
  - 任何 PRD/EngineSpec/APISpec 明确的 CE01/02/05/07/08/09 缺失 = 阻断 FAIL
  - 禁止写"文档未明确"来规避

### 1.3 证据收集脚本

**脚本路径**: `tools/verify/align_v2.sh`

**执行命令**:

```bash
bash tools/verify/align_v2.sh
```

---

## 二、A) DBSpec V1.1 验证

### A1) projects.settings_json 字段

**文档要求**: `projects.settings_json`（项目级配置 JSON）

**代码实现**:

```bash
grep -n 'settings_json\|settingsJson\|metadata' packages/database/prisma/schema.prisma | grep -i project
```

**结果**: 未找到 `settings_json` 字段

**证据位置**: `packages/database/prisma/schema.prisma:96`

```prisma
metadata       Json? // { timeline, progress, settings }
```

**判定**: ❌ **FAIL** - 字段名不符合规范（应为 `settings_json`，实际为 `metadata`）

---

### A2) 核心实体存在性检查

**文档要求**: `shot_variants`, `worker_nodes`, `billing_plans`, `billing_records`, `assets`, `models`, `audit_logs`, `system_settings`

**代码实现**:

```bash
grep -n '^model ' packages/database/prisma/schema.prisma | grep -E '(ShotVariant|WorkerNode|Asset|AuditLog|SystemSetting|BillingPlan|BillingRecord|Model)'
```

**结果**:

- ✅ `ShotVariant`: `packages/database/prisma/schema.prisma:1161`
- ✅ `WorkerNode`: `packages/database/prisma/schema.prisma:516`
- ✅ `Asset`: `packages/database/prisma/schema.prisma:1137`
- ✅ `AuditLog`: `packages/database/prisma/schema.prisma:1103`
- ❌ `SystemSetting`: 未找到
- ❌ `BillingPlan`: 未找到（只有 `BillingEvent`）
- ❌ `BillingRecord`: 未找到（只有 `BillingEvent`）
- ❌ `Model`: 未找到（只有 `ModelRegistry`）

**证据位置**:

- `BillingEvent`: `packages/database/prisma/schema.prisma:614`
- `ModelRegistry`: `packages/database/prisma/schema.prisma:544`

**判定**: ❌ **FAIL** - 缺少 `SystemSetting`, `BillingPlan`, `BillingRecord`, `Model` 实体

---

### A3) V1.1 扩展实体存在性检查

**文档要求**: `characters`, `novel_volumes`, `novel_chapters`, `novel_scenes`, `memory_short_term`, `memory_long_term`, `security_fingerprints`

**代码实现**:

```bash
grep -n '^model ' packages/database/prisma/schema.prisma | grep -E '(Character|NovelVolume|NovelChapter|NovelScene|MemoryShortTerm|MemoryLongTerm|SecurityFingerprint)'
```

**结果**:

- ✅ `Character`: `packages/database/prisma/schema.prisma:1189`
- ✅ `NovelVolume`: `packages/database/prisma/schema.prisma:1205`
- ✅ `NovelChapter`: `packages/database/prisma/schema.prisma:959`
- ✅ `NovelScene`: `packages/database/prisma/schema.prisma:1216`
- ✅ `MemoryShortTerm`: `packages/database/prisma/schema.prisma:1231`
- ✅ `MemoryLongTerm`: `packages/database/prisma/schema.prisma:1243`
- ✅ `SecurityFingerprint`: `packages/database/prisma/schema.prisma:1152`

**判定**: ✅ **PASS** - 所有 V1.1 扩展实体都存在

---

### A4) 索引存在性检查

**文档要求**:

- `shots(scene_id, index)`
- `tasks(status, created_at)`
- `audit_logs(nonce, timestamp)`
- `characters(project_id, name)`
- `novel_scenes(chapter_id, index)`
- `assets(asset_id, watermark_mode)`

**代码实现**:

```bash
grep -n '@@index' packages/database/prisma/schema.prisma | grep -E '(sceneId|status.*createdAt|nonce.*timestamp)'
```

**结果**:

- ✅ `shots(sceneId, index)`: `packages/database/prisma/schema.prisma:214`
- ✅ `tasks(status, createdAt)`: `packages/database/prisma/schema.prisma:450`
- ✅ `audit_logs(nonce, timestamp)`: `packages/database/prisma/schema.prisma:1129`
- ✅ `characters(projectId, name)`: `packages/database/prisma/schema.prisma:1201`
- ✅ `novel_scenes(chapterId, index)`: `packages/database/prisma/schema.prisma:1227`
- ⚠️ `assets(asset_id, watermark_mode)`: 需验证

**证据位置**:

- `shots`: `packages/database/prisma/schema.prisma:214` - `@@index([sceneId, index])`
- `tasks`: `packages/database/prisma/schema.prisma:450` - `@@index([status, createdAt])`
- `audit_logs`: `packages/database/prisma/schema.prisma:1129` - `@@index([nonce, timestamp])`
- `characters`: `packages/database/prisma/schema.prisma:1201` - `@@index([projectId, name])`
- `novel_scenes`: `packages/database/prisma/schema.prisma:1227` - `@@index([chapterId, index])`

**Asset 索引验证**:

```bash
grep -n '@@index.*asset\|@@index.*watermark' packages/database/prisma/schema.prisma -i
```

**结果**: 未找到 `assets` 表的 `(asset_id, watermark_mode)` 索引

**判定**: ❌ **FAIL** - 缺少 `assets(asset_id, watermark_mode)` 索引

---

## 三、B) APISpec V1.1 验证

### B1) CE09 Asset 接口

**文档要求**:

- `GET /assets/:assetId/secure-url`
- `GET /assets/:assetId/hls`
- `POST /assets/:assetId/watermark`

**代码实现**:

```bash
grep -rn '@Get\|@Post' apps/api/src --include='*.controller.ts' | grep -E '(asset|secure-url|hls|watermark)'
```

**结果**: 未找到

**判定**: ❌ **FAIL** - CE09 Asset 接口不存在

---

### B2) CE07/CE08 Memory 接口

**文档要求**:

- `GET /memory/short-term/:chapterId`
- `GET /memory/long-term/:entityId`
- `POST /memory/update`

**代码实现**:

```bash
grep -rn '@Get\|@Post' apps/api/src --include='*.controller.ts' | grep -E '(memory|short-term|long-term)'
```

**结果**: 未找到

**判定**: ❌ **FAIL** - CE07/CE08 Memory 接口不存在

---

### B3) CE05 Shot 接口 (inpaint/pose)

**文档要求**:

- `POST /shots/:shotId/inpaint`
- `POST /shots/:shotId/pose`

**代码实现**:

```bash
grep -rn '@Post' apps/api/src --include='*.controller.ts' | grep -E '(inpaint|pose)'
```

**结果**: 未找到（仅在 `novel-import.service.ts:134` 找到 `posePreset: 'default'`，非 API 端点）

**判定**: ❌ **FAIL** - CE05 Shot 接口 (inpaint/pose) 不存在

---

### B4) CE10 RequireSignature 覆盖范围

**文档要求**: 高成本/敏感接口必须强制签名校验

**代码实现**:

```bash
grep -rn '@RequireSignature' apps/api/src --include='*.ts'
```

**结果**:

- ✅ `apps/api/src/story/story.controller.ts:34` - `POST /story/parse` (CE06)
- ✅ `apps/api/src/text/text.controller.ts:35` - `POST /text/visual-density` (CE03)
- ✅ `apps/api/src/text/text.controller.ts:62` - `POST /text/enrich` (CE04)
- ✅ `apps/api/src/ce-engine/ce-engine.controller.ts:35,62,89` - CE Core 接口
- ✅ `apps/api/src/novel-import/novel-import.controller.ts:72,313,487` - 小说导入接口

**判定**: ✅ **PASS** - CE10 RequireSignature 已覆盖高成本接口

---

## 四、C) PRD/EngineSpec 关键流程验证

### C1) CE01 角色三视图 (seed/embedding)

**文档要求**: 创建项目阶段必须生成角色三视图（CE01）并绑定 seed/embedding

**代码实现**:

```bash
grep -rn 'CE01\|角色三视图\|seed\|embedding' apps/api/src --include='*.ts' | head -20
```

**结果**: 未找到

**证据位置**: `packages/database/prisma/schema.prisma:1189-1203` - `Character` 模型存在 `embeddingId` 和 `defaultSeed` 字段，但无 CE01 实现

**判定**: ❌ **FAIL** - CE01 角色三视图功能不存在

---

### C2) CE06→CE03→CE04 串联证据

**文档要求**: 文本导入流程：CE06 → CE03 → CE04 串联

**代码实现**:

```bash
grep -rn 'handleCECoreJobSuccess\|CE06.*CE03\|CE03.*CE04' apps/api/src --include='*.ts'
```

**结果**:

- ✅ `apps/api/src/job/job.service.ts:1619-1652` - `handleCECoreJobSuccess()` 实现串联逻辑
  - 第 1619 行: `if (job.type === JobTypeEnum.CE06_NOVEL_PARSING)` - CE06 完成检测
  - 第 1620-1635 行: CE06 完成触发 CE03
  - 第 1636-1652 行: CE03 完成触发 CE04

**证据位置**:

```typescript
// apps/api/src/job/job.service.ts:1619-1652
if (job.type === JobTypeEnum.CE06_NOVEL_PARSING) {
  // CE06 完成，触发 CE03
  if (pipeline.includes('CE03_VISUAL_DENSITY')) {
    await this.createCECoreJob({
      jobType: JobTypeEnum.CE03_VISUAL_DENSITY,
      // ...
    });
  }
} else if (job.type === JobTypeEnum.CE03_VISUAL_DENSITY) {
  // CE03 完成，触发 CE04
  if (pipeline.includes('CE04_VISUAL_ENRICHMENT')) {
    await this.createCECoreJob({
      jobType: JobTypeEnum.CE04_VISUAL_ENRICHMENT,
      // ...
    });
  }
}
```

**判定**: ✅ **PASS** - CE06→CE03→CE04 串联逻辑存在

---

### C3) CE09 安全链路 (HLS/水印/指纹)

**文档要求**: 视频导出进入 CE09 安全链路（HLS/水印/指纹）

**代码实现**:

```bash
grep -rn 'HLS\|watermark\|fingerprint\|securityProcessed' apps/api/src --include='*.ts' | head -20
```

**结果**: 未找到

**证据位置**:

- `packages/database/prisma/schema.prisma:1142` - `Asset.hlsPlaylistUrl` 字段存在
- `packages/database/prisma/schema.prisma:1144` - `Asset.watermarkMode` 字段存在
- `packages/database/prisma/schema.prisma:1145` - `Asset.fingerprintId` 字段存在
- `packages/database/prisma/schema.prisma:1178` - `VideoJob.securityProcessed` 字段存在

但无对应的 API 接口和业务逻辑实现。

**判定**: ❌ **FAIL** - CE09 安全链路（HLS/水印/指纹）功能不存在

---

### C4) CE07 短期记忆使用证据

**文档要求**: 分镜生成使用短期记忆（CE07）

**代码实现**:

```bash
grep -rn 'MemoryShortTerm\|memory.*short\|分镜.*记忆' apps/api/src --include='*.ts' | head -20
```

**结果**: 未找到

**证据位置**: `packages/database/prisma/schema.prisma:1231-1241` - `MemoryShortTerm` 模型存在，但无业务逻辑使用

**判定**: ❌ **FAIL** - CE07 短期记忆使用功能不存在

---

### C5) JobType Enum 中的 CE 引擎

**文档要求**: JobType Enum 应包含所有 CE 引擎（CE01-CE10）

**代码实现**:

```bash
grep -A 50 'enum JobType' packages/database/prisma/schema.prisma | grep -E 'CE[0-9]'
```

**结果**:

- ✅ `CE06_NOVEL_PARSING`: `packages/database/prisma/schema.prisma:761`
- ✅ `CE03_VISUAL_DENSITY`: `packages/database/prisma/schema.prisma:762`
- ✅ `CE04_VISUAL_ENRICHMENT`: `packages/database/prisma/schema.prisma:763`
- ❌ `CE01`: 未找到
- ❌ `CE02`: 未找到
- ❌ `CE05`: 未找到
- ❌ `CE07`: 未找到
- ❌ `CE08`: 未找到
- ❌ `CE09`: 未找到

**证据位置**: `packages/database/prisma/schema.prisma:757-764`

```prisma
enum JobType {
  SHOT_RENDER
  NOVEL_ANALYSIS
  // CE Core Layer
  CE06_NOVEL_PARSING
  CE03_VISUAL_DENSITY
  CE04_VISUAL_ENRICHMENT
}
```

**判定**: ❌ **FAIL** - JobType Enum 中缺少 CE01, CE02, CE05, CE07, CE08, CE09

---

## 五、验证结果汇总

### 5.1 PASS 项

| 项目                      | 状态    | 证据位置                                                        |
| ------------------------- | ------- | --------------------------------------------------------------- |
| A3) V1.1 扩展实体         | ✅ PASS | `packages/database/prisma/schema.prisma:1189-1243`              |
| A4) 部分索引              | ✅ PASS | `packages/database/prisma/schema.prisma:214,450,1129,1201,1227` |
| B4) CE10 RequireSignature | ✅ PASS | `apps/api/src/*.controller.ts` (多处)                           |
| C2) CE06→CE03→CE04 串联   | ✅ PASS | `apps/api/src/job/job.service.ts:1619-1652`                     |

### 5.2 FAIL 项（阻断）

| 项目                       | 状态    | 缺失内容                                                                                         | 证据位置                                         |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| A1) projects.settings_json | ❌ FAIL | 字段名不符合（应为 `settings_json`，实际为 `metadata`）                                          | `packages/database/prisma/schema.prisma:96`      |
| A2) 核心实体               | ❌ FAIL | `SystemSetting`, `BillingPlan`, `BillingRecord`, `Model`                                         | 未找到                                           |
| A4) assets 索引            | ❌ FAIL | `assets(asset_id, watermark_mode)` 索引                                                          | 未找到                                           |
| B1) CE09 Asset 接口        | ❌ FAIL | `GET /assets/:assetId/secure-url`, `GET /assets/:assetId/hls`, `POST /assets/:assetId/watermark` | 未找到                                           |
| B2) CE07/CE08 Memory 接口  | ❌ FAIL | `GET /memory/short-term/:chapterId`, `GET /memory/long-term/:entityId`, `POST /memory/update`    | 未找到                                           |
| B3) CE05 Shot 接口         | ❌ FAIL | `POST /shots/:shotId/inpaint`, `POST /shots/:shotId/pose`                                        | 未找到                                           |
| C1) CE01 角色三视图        | ❌ FAIL | 角色三视图生成和 seed/embedding 绑定                                                             | 未找到                                           |
| C3) CE09 安全链路          | ❌ FAIL | HLS/水印/指纹业务逻辑                                                                            | 未找到                                           |
| C4) CE07 短期记忆          | ❌ FAIL | 分镜生成使用短期记忆                                                                             | 未找到                                           |
| C5) JobType Enum           | ❌ FAIL | CE01, CE02, CE05, CE07, CE08, CE09                                                               | `packages/database/prisma/schema.prisma:757-764` |

---

## 六、结论

### 6.1 最终判定

**ALLOW_RISK_AUDIT = NO**

### 6.2 判定理由

存在 **10 个阻断性 FAIL 项**，不符合上线要求：

1. **数据库规范偏差** (3 项):
   - `projects.settings_json` 字段名不符合规范
   - 缺少 `SystemSetting`, `BillingPlan`, `BillingRecord`, `Model` 实体
   - 缺少 `assets(asset_id, watermark_mode)` 索引

2. **API 规范缺失** (3 项):
   - CE09 Asset 接口不存在
   - CE07/CE08 Memory 接口不存在
   - CE05 Shot 接口 (inpaint/pose) 不存在

3. **引擎功能缺失** (4 项):
   - CE01 角色三视图功能不存在
   - CE09 安全链路（HLS/水印/指纹）功能不存在
   - CE07 短期记忆使用功能不存在
   - JobType Enum 中缺少 CE01, CE02, CE05, CE07, CE08, CE09

### 6.3 建议

在进入雷区检查前，必须先修复所有阻断性 FAIL 项：

1. **数据库修复**:
   - 将 `projects.metadata` 重命名为 `projects.settings_json`，或添加 `settings_json` 字段
   - 添加缺失的实体：`SystemSetting`, `BillingPlan`, `BillingRecord`, `Model`
   - 添加 `assets(asset_id, watermark_mode)` 索引

2. **API 实现**:
   - 实现 CE09 Asset 接口（secure-url, hls, watermark）
   - 实现 CE07/CE08 Memory 接口
   - 实现 CE05 Shot 接口（inpaint, pose）

3. **引擎功能实现**:
   - 实现 CE01 角色三视图功能
   - 实现 CE09 安全链路（HLS/水印/指纹）
   - 实现 CE07 短期记忆使用功能
   - 在 JobType Enum 中添加缺失的 CE 引擎类型

---

## 七、附录：验证脚本

**脚本路径**: `tools/verify/align_v2.sh`

**执行方式**:

```bash
bash tools/verify/align_v2.sh
```

**输出**: 所有验证证据的命令输出和文件位置

---

**报告生成时间**: 2025-12-14  
**验证人员**: Cursor AI Assistant  
**报告版本**: Cursor18 V2
