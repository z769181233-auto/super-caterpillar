# 全量上线差距报告（Full Launch Gap Report）

**生成日期**: 2025-12-18  
**状态**: 🔄 **持续更新**  
**模式**: RESEARCH → PLAN → EXECUTE → REVIEW

---

## 一、报告说明

本报告对照所有官方文档（DBSpec V1.1、APISpec V1.1、各 Stage 规划文档）与当前代码库实现之间的差距。

**每条差距必须标注：**

- ✅ 是否已实现（✅ 已实现 / ❌ 未实现 / ⚠️ 部分实现）
- ✅ 证据（文件路径 / 表 / API）
- ✅ 风险等级（P0/P1/P2）
- ✅ 依赖 Stage（Stage 1 / Stage 2 / Stage 3 / Stage 4）
- ✅ 自动化验证状态（✅ PASS / ❌ FAIL / ⚠️ WARN）
- ✅ 人工验证状态（✅ PASS / ❌ FAIL / ⚠️ WARN）
- ✅ 需要哪些自动化验证（脚本清单）
- ✅ 需要哪些人工验证（Checklist 项）
- ✅ 是否允许 Conditional Close（必须给理由）

**报告更新规则：**

- 每次 Stage Close 后必须更新
- 每次重大代码变更后必须更新
- 每次发现新差距必须立即添加

---

## 二、Stage 1: 平台与安全基座

### 2.1 DB Schema 差距

| 差距ID        | 实体/字段                | 规范要求             |   是否已实现    | 证据                                                                                                                 | 风险等级 |                 依赖 Stage                  |                                                自动化验证                                                |                                      人工验证                                       |                 Conditional Close                 | 状态      |
| :------------ | :----------------------- | :------------------- | :-------------: | :------------------------------------------------------------------------------------------------------------------- | :------: | :-----------------------------------------: | :------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------: | :-----------------------------------------------: | :-------- |
| GAP-S1-DB-001 | `Asset.signed_url`       | `String?`            |  ❌ **未实现**  | **表**: `packages/database/prisma/schema.prisma` (Asset 模型)<br/>**API**: `apps/api/src/storage/storage.service.ts` |  **P0**  |                   Stage 1                   | ❌ FAIL<br/>**脚本**: `npx prisma validate`<br/>**脚本**: `bash tools/gate/run_launch_gates.sh` (Gate 3) | ❌ FAIL<br/>**Checklist**: DB Schema 对齐检查<br/>**Checklist**: 安全字段完整性检查 |        ❌ **不允许**<br/>**理由**: P0 风险        | 🔴 未修复 |
| GAP-S1-DB-002 | `Asset.hls_playlist_url` | `String?`            |  ❌ **未实现**  | **表**: `packages/database/prisma/schema.prisma` (Asset 模型)<br/>**API**: `apps/api/src/storage/storage.service.ts` |  **P0**  |                   Stage 1                   | ❌ FAIL<br/>**脚本**: `npx prisma validate`<br/>**脚本**: `bash tools/gate/run_launch_gates.sh` (Gate 3) |   ❌ FAIL<br/>**Checklist**: DB Schema 对齐检查<br/>**Checklist**: 流媒体能力检查   |        ❌ **不允许**<br/>**理由**: P0 风险        | 🔴 未修复 |
| GAP-S1-DB-003 | `Asset.watermark_mode`   | `Enum`               |  ❌ **未实现**  | **表**: `packages/database/prisma/schema.prisma` (Asset 模型)<br/>**API**: `apps/api/src/storage/storage.service.ts` |  **P0**  |                   Stage 1                   | ❌ FAIL<br/>**脚本**: `npx prisma validate`<br/>**脚本**: `bash tools/gate/run_launch_gates.sh` (Gate 3) |    ❌ FAIL<br/>**Checklist**: DB Schema 对齐检查<br/>**Checklist**: 水印功能检查    |        ❌ **不允许**<br/>**理由**: P0 风险        | 🔴 未修复 |
| GAP-S1-DB-004 | `Asset.fingerprint_id`   | `FK`                 |  ❌ **未实现**  | **表**: `packages/database/prisma/schema.prisma` (Asset 模型)<br/>**关联**: `SecurityFingerprint` 表                 |  **P0**  |                   Stage 1                   | ❌ FAIL<br/>**脚本**: `npx prisma validate`<br/>**脚本**: `bash tools/gate/run_launch_gates.sh` (Gate 3) |  ❌ FAIL<br/>**Checklist**: DB Schema 对齐检查<br/>**Checklist**: 安全指纹关联检查  |        ❌ **不允许**<br/>**理由**: P0 风险        | 🔴 未修复 |
| GAP-S1-DB-005 | `NovelChapter` 关联      | 关联至 `NovelVolume` | ⚠️ **部分实现** | **表**: `packages/database/prisma/schema.prisma` (NovelChapter 模型)<br/>**当前**: 关联至 `NovelSource`              |  **P1**  |                   Stage 1                   |          ❌ FAIL<br/>**脚本**: `npx prisma validate`<br/>**脚本**: `npx prisma migrate status`           |  ❌ FAIL<br/>**Checklist**: DB Schema 层级对齐检查<br/>**Checklist**: 数据迁移验证  | ⚠️ **条件允许**<br/>**理由**: P1 风险，需书面说明 | 🔴 未修复 |
| GAP-S1-DB-006 | `Scene.project_id`       | 必填                 | ⚠️ **部分实现** | **表**: `packages/database/prisma/schema.prisma` (Scene 模型)<br/>**当前**: `projectId String?` (可选)               |  **P1**  |                   Stage 1                   |                  ❌ FAIL<br/>**脚本**: `npx prisma validate`<br/>**脚本**: 约束验证脚本                  |    ❌ FAIL<br/>**Checklist**: DB Schema 约束检查<br/>**Checklist**: 索引效率验证    | ⚠️ **条件允许**<br/>**理由**: P1 风险，需书面说明 | 🔴 未修复 |
| GAP-S1-DB-007 | `Project.settings_json`  | `settings_json`      | ⚠️ **部分实现** | **表**: `packages/database/prisma/schema.prisma` (Project 模型)<br/>**当前**: `metadata Json?` (功能等价)            |  **P2**  | ⚠️ WARN<br/>**脚本**: `npx prisma validate` |                                ✅ PASS<br/>**Checklist**: 字段名对齐检查                                 |                     ✅ **允许**<br/>**理由**: P2 风险，功能等价                     |                     🟡 待对齐                     |
| GAP-S1-DB-008 | `Project.title`          | `title`              | ⚠️ **部分实现** | **表**: `packages/database/prisma/schema.prisma` (Project 模型)<br/>**当前**: `name String` (功能等价)               |  **P2**  | ⚠️ WARN<br/>**脚本**: `npx prisma validate` |                                ✅ PASS<br/>**Checklist**: 字段名对齐检查                                 |                     ✅ **允许**<br/>**理由**: P2 风险，功能等价                     |                     🟡 待对齐                     |

**Stage 1 DB Schema 总体状态**: 🔴 **NOT CLOSE**

---

### 2.2 API 契约差距

| 差距ID         | API 端点       | 规范要求                                     |   是否已实现    | 证据                                                                                                                             | 风险等级 | 依赖 Stage |                                              自动化验证                                              |                                     人工验证                                      |                 Conditional Close                 | 状态        |
| :------------- | :------------- | :------------------------------------------- | :-------------: | :------------------------------------------------------------------------------------------------------------------------------- | :------: | :--------: | :--------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------: | :-----------------------------------------------: | :---------- |
| GAP-S1-API-001 | HMAC Auth 链路 | `HmacAuthGuard` + `TimestampNonceGuard` 完整 | ⚠️ **部分实现** | **文件**: `apps/api/src/auth/hmac/timestamp-nonce.guard.ts`<br/>**问题**: `TimestampNonceGuard` 读取 `request.hmac` 为 undefined |  **P0**  |  Stage 1   | ❌ FAIL<br/>**脚本**: `bash tools/gate/run_launch_gates.sh` (Gate 3)<br/>**脚本**: HMAC 链路专项测试 | ❌ FAIL<br/>**Checklist**: 安全链路完整性检查<br/>**Checklist**: Nonce 防重放验证 |        ❌ **不允许**<br/>**理由**: P0 风险        | 🔴 未修复   |
| GAP-S1-API-002 | 审计日志覆盖率 | 所有关键操作                                 | ⚠️ **部分实现** | **文件**: `apps/api/src/audit/audit-log.service.ts`<br/>**缺失**: 切换组织等操作                                                 |  **P1**  |  Stage 1   |                               ⚠️ WARN<br/>**脚本**: 审计日志覆盖率测试                               | ⚠️ WARN<br/>**Checklist**: 审计日志完整性检查<br/>**Checklist**: 关键操作覆盖验证 | ⚠️ **条件允许**<br/>**理由**: P1 风险，需书面说明 | 🟡 部分修复 |

**Stage 1 API 契约总体状态**: 🔴 **NOT CLOSE**

---

### 2.3 安全链路差距

| 差距ID         | 安全机制       | 规范要求 | 当前实现                                    | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :------------- | :------------- | :------- | :------------------------------------------ | :------: | :--------: | :------: | :-------- |
| GAP-S1-SEC-001 | HMAC 验证      | 完整实现 | ✅ 已实现                                   |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S1-SEC-002 | Nonce 防重放   | 完整实现 | ⚠️ 部分实现（`TimestampNonceGuard` 有 bug） |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S1-SEC-003 | Timestamp 校验 | 完整实现 | ⚠️ 部分实现                                 |  **P1**  |  ⚠️ WARN   | ⚠️ WARN  | 🟡 待完善 |
| GAP-S1-SEC-004 | 资产签名       | 完整实现 | ✅ 已实现                                   |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |

**Stage 1 安全链路总体状态**: 🟡 **CONDITIONAL PASS**（需修复 P0 项）

---

## 三、Stage 2: 任务调度与生产管线

### 3.1 Engine Hub 架构差距

| 差距ID         | 组件/功能           | 规范要求 | 当前实现  | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :------------- | :------------------ | :------- | :-------- | :------: | :--------: | :------: | :-------- |
| GAP-S2-ENG-001 | `EngineRegistryHub` | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S2-ENG-002 | `EngineInvokerHub`  | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S2-ENG-003 | Engine 注册机制     | 动态注册 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S2-ENG-004 | Local/HTTP Adapter  | 完整支持 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |

**Stage 2 Engine Hub 总体状态**: ✅ **CLOSE**（需确认）

---

### 3.2 Orchestrator 差距

| 差距ID         | 功能              | 规范要求 | 当前实现  | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :------------- | :---------------- | :------- | :-------- | :------: | :--------: | :------: | :-------- |
| GAP-S2-ORC-001 | 任务调度算法      | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S2-ORC-002 | Worker 注册与心跳 | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S2-ORC-003 | 任务重试机制      | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S2-ORC-004 | 任务超时处理      | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |

**Stage 2 Orchestrator 总体状态**: ✅ **CLOSE**（需确认）

---

## 四、Stage 3: AI 引擎体系

### 4.1 结构分析引擎（CE06）差距

| 差距ID          | 功能            | 规范要求             | 当前实现            | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :-------------- | :-------------- | :------------------- | :------------------ | :------: | :--------: | :------: | :-------- |
| GAP-S3-CE06-001 | 语义分析能力    | 完整实现             | ❌ 仅为 Import Stub |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S3-CE06-002 | 分镜能力        | 完整实现             | ❌ 仅为文本切片     |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S3-CE06-003 | 导演能力        | 完整实现             | ❌ 缺失             |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S3-CE06-004 | 补全能力        | 完整实现             | ❌ 缺失             |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S3-CE06-005 | Engine Hub 集成 | 通过 Engine Hub 调用 | ✅ 已实现           |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S3-CE06-006 | 结构树生成      | 符合 DBSpec V1.1     | ✅ 已实现           |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |

**Stage 3 CE06 总体状态**: 🔴 **NOT CLOSE**（核心能力缺失）

**⚠️ 重要认定**: 当前小说分析引擎仅为 Import Stub / 文本切片器，不具备任何语义分析、分镜、导演、补全能力。在 Stage 3 Close 之前，禁止作为任何生产依赖。

---

### 4.2 Studio 前端差距

| 差距ID        | 功能       | 规范要求 | 当前实现    | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :------------ | :--------- | :------- | :---------- | :------: | :--------: | :------: | :-------- |
| GAP-S3-UI-001 | 结构树展示 | 完整展示 | ✅ 已实现   |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S3-UI-002 | 结构树编辑 | 完整编辑 | ⚠️ 部分实现 |  **P1**  |  ⚠️ WARN   | ⚠️ WARN  | 🟡 待完善 |

**Stage 3 Studio 前端总体状态**: 🟡 **CONDITIONAL PASS**

---

## 五、Stage 4: 质量、安全、自动修复与发布治理

### 5.1 质量门禁差距

| 差距ID        | 功能         | 规范要求 | 当前实现  | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :------------ | :----------- | :------- | :-------- | :------: | :--------: | :------: | :-------- |
| GAP-S4-QA-001 | 质量门禁系统 | 完整实现 | ❌ 未实现 |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S4-QA-002 | 自动修复机制 | 完整实现 | ❌ 未实现 |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |
| GAP-S4-QA-003 | 发布治理流程 | 完整实现 | ❌ 未实现 |  **P0**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |

**Stage 4 质量门禁总体状态**: 🔴 **NOT CLOSE**

---

### 5.2 监控与告警差距

| 差距ID         | 功能         | 规范要求 | 当前实现  | 风险等级 | 自动化验证 | 人工验证 | 状态      |
| :------------- | :----------- | :------- | :-------- | :------: | :--------: | :------: | :-------- |
| GAP-S4-MON-001 | Health Check | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S4-MON-002 | Metrics 端点 | 完整实现 | ✅ 已实现 |    -     |  ✅ PASS   | ✅ PASS  | ✅ 已修复 |
| GAP-S4-MON-003 | 告警机制     | 完整实现 | ❌ 未实现 |  **P1**  |  ❌ FAIL   | ❌ FAIL  | 🔴 未修复 |

**Stage 4 监控与告警总体状态**: 🟡 **CONDITIONAL PASS**

---

## 六、差距汇总

### 6.1 按风险等级汇总

| 风险等级 | 差距数量 | 状态        |
| :------- | :------: | :---------- |
| **P0**   |    12    | 🔴 未修复   |
| **P1**   |    5     | 🟡 部分修复 |
| **P2**   |    2     | 🟡 待对齐   |

### 6.2 按 Stage 汇总

| Stage       | 差距数量 | Close 状态         |
| :---------- | :------: | :----------------- |
| **Stage 1** |    10    | 🔴 NOT CLOSE       |
| **Stage 2** |    0     | ✅ CLOSE（需确认） |
| **Stage 3** |    5     | 🔴 NOT CLOSE       |
| **Stage 4** |    4     | 🔴 NOT CLOSE       |

### 6.3 按验证状态汇总

| 验证状态                           | 差距数量 |
| :--------------------------------- | :------: |
| ✅ 自动化验证 PASS + 人工验证 PASS |    8     |
| ❌ 自动化验证 FAIL                 |    12    |
| ⚠️ 自动化验证 WARN                 |    5     |

---

## 七、修复优先级

### P0 优先级（必须立即修复）

1. **GAP-S1-DB-001 ~ GAP-S1-DB-004**: `Asset` 表缺失关键安全字段
2. **GAP-S1-API-001**: HMAC Auth 链路 bug（`TimestampNonceGuard`）
3. **GAP-S3-CE06-001 ~ GAP-S3-CE06-004**: 结构分析引擎核心能力缺失
4. **GAP-S4-QA-001 ~ GAP-S4-QA-003**: 质量门禁系统未实现

### P1 优先级（Stage Close 前必须修复）

1. **GAP-S1-DB-005 ~ GAP-S1-DB-006**: Schema 层级问题
2. **GAP-S3-UI-002**: Studio 前端编辑功能待完善
3. **GAP-S4-MON-003**: 告警机制未实现

### P2 优先级（可延后对齐）

1. **GAP-S1-DB-007 ~ GAP-S1-DB-008**: 字段名不匹配（功能等价）

---

## 八、报告更新记录

| 日期       | 更新内容     | 更新人 |
| :--------- | :----------- | :----- |
| 2025-12-18 | 初始报告创建 | Cursor |

---

**报告维护**: 每次 Stage Close 或重大代码变更后必须更新本报告。
