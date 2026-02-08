# ENGINE_SEAL_MATRIX_SSOT.md

> **Super Caterpillar / 毛毛虫宇宙**
> **核心引擎 L1/L2 Seal 矩阵 (Single Source of Truth)**

---

## 1. Orchestrator V2 (调度器 V2 - Audio 集成)

| 维度                             | 状态             | 验证人      | 证据链                                                                                                                                                                                                                                           |
| :------------------------------- | :--------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1: Code Quality**             | ✅ SEALED        | Antigravity | [OrchestratorService](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/apps/api/src/orchestrator/orchestrator.service.ts)                                                                                                          |
| **L2: Cross-Engine Integration** | ✅ SEALED (Real) | Antigravity | [gate-orch-v2-audio-l2-real.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate-orch-v2-audio-l2-real.sh)                                                                                                   |
| **L3: Indisputable Determinism** | ✅ CI Enabled    | Antigravity | [L3 Manifest](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/ORCH_V2_AUDIO_L3_MANIFEST.json) + [CI Gate](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate-orch-v2-audio-l3-manifest.sh) |

---

## 2. 核心逻辑验证说明 (L2 Seal Basis)

### 2.1 Dual-Track DAG

- **Trigger**: `SHOT_RENDER` 完成。
- **Action**: 并行触发 `VIDEO_RENDER` 与 `AUDIO` (集成音频生成)。
- **Verification**: `gate-prod_slice_v1_audio.sh` 模拟 Worker 完成并验证后续 Job 成功生成。

### 2.2 Security & Authentication

- **HMAC_V2**: 所有 Gate 触发均通过 ApiClient 的 HMAC_V2 (v1.1) 签名验证（127.0.0.1 强制路径）。
- **Manifest**: `signingScheme: HMAC_1_1`
- **Prerequisites**: 包含 Organization Credits、User Memberships 和 Engine Binding 校验。

### 2.3 L3 Determinism (Audio Binary Seal)

- **Scope**: 全链路二进制一致性验证 (R1/R2 Double Pass)。
- **Method**: 连续两次运行 `gate-orch-v2-audio-l3-r1r2.sh`，生成 `input_boundaries.json`。
- **Verdict**: 音频产物 SHA256 指纹完全一致 (`b3e4be24...`)，证明流程确定性。

---

## 3. 下一步计划 (Post-Seal)

- [ ] L3: Full Production Slice (L3 Manifest 持续集成)

---

## 4. SHOT_RENDER L3 Seal (W3-1 - DB Traceability Required)

| 维度                             | 状态                        | 验证人      | 证据链                                                                                                                                                                                     |
| :------------------------------- | :-------------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1: Code Quality**             | ✅ SEALED                   | Antigravity | [JobService.create](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/apps/api/src/job/job.service.ts#L133)                                                                   |
| **L2: Contract + Job Loop**      | ✅ SEALED (DB Optional)     | Antigravity | [W3-1 L2 Evidence](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/w3_1_seal_fix_20260207_232857/)                                                           |
| **L3: DB Traceability Required** | ✅ SEALED (Commercial Grade) | Antigravity | [W3-1 L3 Evidence](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/w3_1_l3_db_required_20260208_102428/) |

### L3 Required Gates

SHOT_RENDER 达到 L3 封板等级时，必须通过以下所有 Gate：

1. **Gate 17**: ORIGIN_NATIVE_DROP Contract  
   - Script: [gate17.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate17.sh)
   - Verifies: 产物文件存在性、SHA256 完整性

2. **Gate 18 (Contract)**: Engine Provenance Contract  
   - Script: [gate_engine_provenance.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate_engine_provenance.sh)
   - Verifies: Provenance JSON 契约约束

3. **Gate 18b (DB Trace Required)**: DB Traceability Enforcement  
   - Script: [gate18_dbtrace_required.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate18_dbtrace_required.sh)
   - Verifies: `shot_jobs` record, `shot_job_artifacts` records, SHA256 match
   - **Hard Fails**: DATABASE_URL missing (exit 12), DB unreachable (exit 13), records missing (exit 16)

### L3 Technical Requirements

- `shot_jobs` 表必须包含: `status=SUCCEEDED`, `outputSha256` 非空
- `shot_job_artifacts` 表必须包含至少 2 条记录: `SHOT_RENDER_OUTPUT_MP4`, `PROVENANCE_JSON`
- Worker 必须在 job 成功时自动写入 DB 记录（禁止手动补写）
- `@@unique([jobId, kind])` 约束确保幂等写入

---

## 5. Stage 4: Novel Import Engines (The Shredder)

| 维度                             | 状态                        | 验证人      | 证据链                                                                                                                                                                                     |
| :------------------------------- | :-------------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1: Code Quality**             | ✅ SEALED                   | Antigravity | [StreamScanner](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/packages/ingest/stream_scan.ts)                                                                             |
| **L2: Scalability & Idempotency**| ✅ SEALED (Logic Verified)  | Antigravity | [Stage 4 Handover](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/stage4_scaling_15m_20260208_142823/)                                                      |

### Verified Capabilities
- **Streaming**: Byte-range scanning avoids OOM.
- **Fan-out**: Single `SCAN` job triggers N `CHUNK_PARSE` jobs.
- **Idempotency**: `organization_members` UPSERT fix verified.
