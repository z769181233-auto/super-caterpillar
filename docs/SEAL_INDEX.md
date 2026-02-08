# Super Caterpillar Engine Sealing Index (SSOT)

本文档记录了毛毛虫宇宙 (Super Caterpillar) 所有通过工业级门禁 (Industrial Gate) 验证并封板的引擎节点。

---

## 审计规格标准 (Audit Standards - V2 Hardened)

### 1. 证据项分层 (Evidence Layers)

| 证据文件                | 类型         | 判定标准                                                             |
| :---------------------- | :----------- | :------------------------------------------------------------------- |
| **REQ.json**            | **REQUIRED** | 标准请求载荷                                                         |
| **RUN.json**            | **REQUIRED** | 标准响应结果 (success=true)                                          |
| **SQL_AUDIT.json**      | **REQUIRED** | 审计日志匹配 (details/payload 关联)                                  |
| **SQL_LEDGER.json**     | **REQUIRED** | 账本隔离验证 (count=0)                                               |
| **SHA256SUMS.txt**      | **REQUIRED** | 防篡改哈希清单                                                       |
| **SUMMARY.md**          | **REQUIRED** | 机器+人工审阅摘要                                                    |
| **SQL_JOB.json**        | _OPTIONAL_   | 当直接调用不涉及 `shot_jobs` 时，此项应为 `[]` 并于 SUMMARY 中说明。 |
| **RUN_IDEMPOTENT.json** | _OPTIONAL_   | 仅用于 L2 等级封板，记录第二次调用结果。                             |

### 2. 等级判定准则 (Seal Level Criteria)

- **Seal-L0 (Spec)**: 只要求 REQ.json 与门禁通过。
- **Seal-L1 (Integrate)**: 要求 REQ/RUN/SQL_AUDIT 闭环。
- **Seal-L2 (Real)**: **强制要求** 产物硬校验 (ffprobe) 与 幂等性强断言 (URI match)。

---

## 封板历程记录 (Seal Journal)

### Phase 0: Real Engine Sealing (L2 等级)

| 阶段      | 引擎节点                 | 状态      | 等级   | 证据目录 (SSOT)                                                                                                                                                |
| :-------- | :----------------------- | :-------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-R1** | [CE06] Novel Parsing     | ✅ SEALED | **L2** | [p0_r1_..._v2h_20260114_235250](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r1_ce02_ce06_real_v2h_20260114_235250)         |
| **P0-R2** | [CE03] Visual Density    | ✅ SEALED | **L2** | [p0_r2_..._v2h_20260114_235251](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r2_ce02_ce03_real_v2h_20260114_235251)         |
| **P0-R3** | [CE04] Visual Enrichment | ✅ SEALED | **L2** | [p0_r3_..._v2h_20260114_235251](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r3_ce02_ce04_real_v2h_20260114_235251)         |
| **P0-R4** | [VIDEO_RENDER] Merge     | ✅ SEALED | **L2** | [p0_r4_..._v2h_20260114_235225](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r4_ce02_video_render_real_v2h_20260114_235225) |

---

## 历史里程碑 (Archived Milestones)

- **Stage 3**: 事件驱动 DAG 与多 Worker 负载均衡封板 (2026-01-14)
- **Stage 1**: `isVerification` 传播链与视频渲染流程验证 (2026-01-14)
- **CE-ARCH-GUARD-02**: 引擎调用界面 SSOT 门禁通过 (2026-01-10)
- **Tag**: W2_REAL_ENGINE_ACCEPT_SEALED_20260206_232838
- **Status**: PASSED (Manual Repair Verified)
