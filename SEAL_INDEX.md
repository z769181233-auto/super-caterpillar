  # SEAL INDEX

  ## P6-1-5 BUSINESS SEALED (CONSOLIDATED)
  - **Status**: BUSINESS SEALED (PATCH APPLIED)
  - **Primary Tag**: P6-1-5_BILLING_BUSINESS_SEALED_PATCH_20260205_213343
  - **Supersedes**: P6-1-5_BILLING_BUSINESS_SEALED_20260205_210633 (Manual phrasing correction)
  - **Evidence**: docs/_evidence/p6_1_5_billing_business_verify_patch_20260205_211959/
  - **Consolidation Trace**: EVI=docs/_evidence/p6_1_5_doc_hygiene_20260205_214204/

  ## P6-2 ERROR MATRIX (PATCH SEALED)
  - **Status**: PATCH SEALED (HARDENED)
  - **Primary Tag**: P6-2_ERROR_MATRIX_PATCH_20260205_230702
  - **Evidence**: docs/_evidence/p6_2_error_matrix_20260205_230211/
  - **Gate**: tools/gate/gates/gate_p6_2_error_matrix.sh
  - **Notes**:
    - Case03 uses gate_security_negative.sh (real auth/HMAC failure) and enforces Ledger delta=0.
    - Case04 uses PID SSOT + port fallback; includes curl/psql timeouts to prevent hangs.

  ## P6-2.1 CI INTEGRATION (PATCH SEALED)
  - **Status**: PATCH SEALED (本地验证模式)
  - **Primary Tag**: P6-2_1_CI_HARDEN_SEALED_20260206_001730
  - **Supersedes**: P6-2_1_CI_HARDEN_SEALED_20260205_233136
  - **Evidence**:
    - Local Validation: docs/_evidence/run_launch_gates_20260205_235610/
  - **Environment**: 本地 Git 仓库（非 GitHub）
  - **Changes**:
    - Added `GATE_ENV_MODE=ci` semantics to `run_launch_gates.sh`.
    - Integrated P6-2 as Required Check in CI mode.
    - Fixed Post Pollution Gate cleanliness in CI.
  - **Notes**: 
    - 本地 Git 环境，无远程 GitHub Actions
    - CI 模式验证通过（本地执行）

  ## Week 1 D2/D3 ENGINE SANITY (PATCH SEALED)
  - **Status**: Sanity Gate HARDENED
  - **Primary Tag**: W1_D2D3_ENGINE_SANITY_HARDEN_SEALED_20260206_200413
  - **Evidence**: docs/_evidence/week1_d2d3_engine_sanity_patch_20260206_200413/
  - **Test Log**: docs/_evidence/week1_d2d3_engine_sanity_patch_20260206_200413/test_log.txt
  - **Changes**:
    - Hardened gate_engine_sanity.sh with PROJECT_ROOT/TEMP_DIR/sha256 improvements.
    - Implemented "threshold fail" for black frame detection.
    - Verified with tools/gate/tests/test_gate_engine_sanity.sh (good/black videos).

  ## Week 1 D4 WIRING INTEGRATION (SEALED)
  - **Status**: E2E Wiring SEALED (Surrogate Validated)
  - **Primary Tag**: W1_D4_WIRING_SURROGATE_SEALED_20260206_202826
  - **Supersedes**: W1_D4_REAL_ENGINE_SEALED_20260206_201957 (Misnamed; wiring/surrogate focus)
  - **Evidence**: docs/_evidence/week1_d4_engine_real_seal_20260206_201957/
  - **Gate Result**: Gate 17 PASS (Validated with surrogate high-bitrate mp4)
  - **Artifact Path**: artifacts/shot_render_output.mp4 (SSOT contract)
  - **Notes**: Validated gate wiring + blackdetect logic; real SHOT_RENDER engine provenance (job/ledger) not sealed in Week 1.

  ## W3-1 JOB SYSTEM LOOP (SEALED_L2_DB_OPTIONAL)
  - **Status**: SEALED (DB Traceability Optional)
  - **Primary Tag**: W3-1_SEAL_FIX_20260207_232857
  - **Evidence**: docs/_evidence/w3_1_seal_fix_20260207_232857/
  - **Gate Results**:
    - Gate 17 (ORIGIN_NATIVE_DROP Contract): ✅ PASS
    - Gate 18 (Engine Provenance - Contract): ✅ PASS
    - Gate 18 (DB Traceability): ⚠️ SKIPPED (DATABASE_URL not set)
  - **Verification Scope**:
    - ✅ File integrity verified (mp4 + provenance sha256)
    - ✅ Contract constraints verified
    - ✅ Job loop verified (API → Job → Worker → artifacts → gates)
    - ⚠️ DB traceability skipped (optional check)
  - **Notes**: 
    - Job System 端到端闭环已验证
    - Worker 自动生成 Gate 规范产物（frames.txt, output.mp4, provenance.json）
    - L3 升级（DB Traceability Required）需硬化 SQL 执行环境与职责收口

  ## W3-1 JOB SYSTEM LOOP (SEALED_L3_DB_REQUIRED)
  - **Status**: SEALED (DB Traceability Required - Commercial Grade)
  - **Primary Tag**: W3-1_L3_DB_REQUIRED_20260208
  - **Supersedes**: W3-1_SEAL_FIX_20260207_232857 (SEALED_L2_DB_OPTIONAL)
  - **Evidence**: docs/_evidence/w3_1_l3_db_required_*/
  - **Gate Results**:
    - Gate 17 (ORIGIN_NATIVE_DROP Contract): ✅ PASS
    - Gate 18 (Engine Provenance - Contract): ✅ PASS
    - Gate 18 (DB Traceability Required): ✅ PASS (exit 0)
  - **Verification Scope**:
    - ✅ File integrity verified (mp4 + provenance sha256)
    - ✅ Contract constraints verified
    - ✅ Job loop verified (API → Job → Worker → artifacts → gates)
    - ✅ **DB traceability verified (REQUIRED - L3)**
      - `shot_jobs.status = SUCCEEDED`
      - `shot_jobs.outputSha256` recorded
      - `shot_job_artifacts` records (MP4 + PROVENANCE_JSON)
      - `DB_TRACE_OK.txt` generated
  - **Technical Enhancements**:
    - Added `@@unique([jobId, kind])` constraint to `ShotJobArtifact`
    - Worker auto-generates Gate-contract artifacts (`shot_render_output.mp4`, `provenance.json`, `.sha256`)
    - Worker writes DB traceability records on job success
    - Gate 18 DB Trace Required enforces hard failure on missing DATABASE_URL/DB records
  - **Notes**: 
    - Job System 端到端闭环已验证（含强制 DB traceability）
    - 商业级无争议封板：所有 Gate 必须 PASS，DB 记录必须存在且匹配
    - L2 → L3 升级完成，职责收口到位（API 入队 + Worker 回写 + Gate 强制验证）

## Phase 5: Observability Seal (Evidence Sealed)
- **Status**: GO-LIVE READY / AUDIT PASSED
- **Primary Tag**: PHASE5_OBSERVABILITY_SEAL_20260208_172500
- **Evidence**: docs/_evidence/phase5_observability_seal_20260208_170304/
- **Verification**:
  - ✅ Unified Metrics (API:3000/metrics proxies Worker:3001)
  - ✅ RSS Definition Validated (Internal Peak vs Swarm Total)
  - ✅ Nightly 3MB Baseline Gate Formalized

- **Phase 6**: Go-Live Engineering - Nightly Gate + Runbook (PENDING EVIDENCE)
