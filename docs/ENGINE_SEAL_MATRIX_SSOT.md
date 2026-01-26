# ENGINE_SEAL_MATRIX_SSOT.md

> **Super Caterpillar / 毛毛虫宇宙**
> **核心引擎 L1/L2 Seal 矩阵 (Single Source of Truth)**

---

## 1. Orchestrator V2 (调度器 V2 - Audio 集成)

| 维度 | 状态 | 验证人 | 证据链 |
| :--- | :--- | :--- | :--- |
| **L1: Code Quality** | ✅ SEALED | Antigravity | [OrchestratorService](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/apps/api/src/orchestrator/orchestrator.service.ts) |
| **L2: Cross-Engine Integration** | ✅ SEALED | Antigravity | [gate-orch-v2-audio-l2-real.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate-orch-v2-audio-l2-real.sh) |
| **L3: Indisputable Determinism** | ✅ SEALED | Antigravity | [gate-orch-v2-audio-l3-r1r2.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/tools/gate/gates/gate-orch-v2-audio-l3-r1r2.sh) + [L3 Manifest](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/ORCH_V2_AUDIO_L3_MANIFEST.json) |

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
