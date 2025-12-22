# Stage 1 差异分析报告 (Gap Report) & 对齐分析

**生成日期**: 2025-12-18
**状态**: 草稿 (DRAFT)
**模式**: RESEARCH

## 1. 概述
本报告记录了“超级毛毛虫宇宙”规格说明书 (V1.1) 与当前代码库实现之间的差异。
**核心目标**: 达成 Stage 1 Close 条件 (DB Spec, API Spec, Safety Spec 完全对齐)。

## 2. DB Spec V1.1 vs 实现差异 (Prisma)

### 核心差异 (P0 - 安全与核心架构)
| 实体 | 规范要求 | 当前实现 | 差异 / 风险 |
| :--- | :--- | :--- | :--- |
| **Asset** | `signed_url` (String) | 缺失 | **P0**: 存在“裸链接被盗”风险。所有资产必须受签名 URL 保护。 |
| **Asset** | `hls_playlist_url` (String) | 缺失 | **P0**: 缺失流媒体播放能力。 |
| **Asset** | `watermark_mode` (Enum) | 缺失 | **P0**: 缺失水印状态追踪。 |
| **Asset** | `fingerprint_id` (FK) | 缺失 | **P0**: 缺失安全指纹关联 (虽然 `SecurityFingerprint` 表已存在)。 |

### 结构与层级差异 (P1)
| 实体 | 规范要求 | 当前实现 | 差异 / 风险 |
| :--- | :--- | :--- | :--- |
| **NovelChapter** | 关联至 `NovelVolume` | 关联至 `NovelSource` | **P1**: 层级不符 (规范: Project>Volume>Chapter vs 现状: Project>Source>Chapter)。 |
| **Scene** | `project_id` (必填) | `projectId` (可选) | **P1**: 索引效率受影响，层级约束未强制。 |
| **Project** | `settings_json` | `metadata` | **P2**: 字段名不匹配 (功能上存在等价物)。 |
| **Project** | `title` | `name` | **P2**: 字段名不匹配。 |
| **Task** | `worker_id` | `workerId` (无 @map) | **P2**: DB 列名大小写可能不符 (DB通常用 snake_case)。 |
| **Task** | `retries` | `attempts` | **P2**: 字段名不匹配。 |

## 3. API Spec V1.1 vs 实现差异

### 安全链路 (HMAC/Nonce/Timestamp)
- **状态**: **阻断 / 不完整**
- **发现**:
    - `HmacAuthGuard` 正确校验了头部并设置了 `request.hmacNonce`, `request.hmacTimestamp` 等分散属性。
    - `TimestampNonceGuard` 试图读取 `request.hmac` 对象，该对象在运行时为 **undefined**。
    - **后果**: `TimestampNonceGuard` 极可能崩溃或验证失效，导致防重放机制旁路。
    - **修正方案**: 更新 `TimestampNonceGuard` 以读取 `HmacAuthGuard` 设置的标准化请求属性。

### 审计日志覆盖率
- **状态**: **大部分符合**
- **发现**:
    - `AuditLog` 模型包含 `payload`, `nonce`, `signature`, `timestamp`。
    - `AuditLogService` 能够写入 `payload`。
    - **风险**: 旧的 `AuditLogLegacy` 模型仍然存在，可能会被遗留代码使用。`HmacAuthGuard` 失败路径的审计已存在。

## 4. 契约对齐结论
1.  **Stage 1 尚未 Close**。`Asset` 表缺失关键安全字段。
2.  **Auth 链路脆弱**。`HmacAuthGuard` 与 `TimestampNonceGuard` 之间的数据传递存在断层。
3.  **DB 层级需修正**。小说结构 (Novel Structure) 需对齐 V1.1 (引入 Volume 概念)。

## 5. 下一步行动 (PLAN 建议)
1.  **DB 迁移**: 为 `Asset` 添加缺失字段。修正 `NovelChapter` 层级 (创建 `NovelVolume` 表或建立正确映射)。
2.  **API 修复**: 修复 `TimestampNonceGuard` 以读取正确的 request 属性。
3.  **验证**: 运行 `security_negative_test.ts` 证明 Auth/Safety 链路功能正常。

---
**差异报告结束**
