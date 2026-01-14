# Seal Index

本文档记录 Super Caterpillar / 毛毛虫宇宙 项目的阶段性封板信息。

---

### Stage 3: Event-Driven DAG + Multi-Worker Concurrency (Gate S3 Hardened)

- **封板日期**: 2026-01-14
- **Tag**: `seal/stage3_s3_gate_hardened_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-s3-scale-event-dag.sh`
- **证据目录**: `docs/_evidence/S3_SCALE_EVENT_DAG_<timestamp>/`
- **关键证据**:
  - `api.log.truncated`（含 HMAC_DEBUG_STEP 与 DAG 非阻塞证明）
  - `db_assert.json`（幂等性/workerId 审计/分组统计）
  - `unauthorized_test.json`（越权 complete 阻断）
  - `EVIDENCE_INDEX.json`（sha256 索引）
- **结论**: Gate S3 TOTAL PASS；HMAC SSOT 统一；4003/500 阻塞项清零；Stage-1 真实视频回归未破坏

---

### Stage 1: isVerification 验证链路封板（SHOT_RENDER → VIDEO_RENDER 传播）

- **封板日期**: 2026-01-14
- **Tag**: `seal/stage1_isVerification_videoRender_20260114`
- **pipelineRunId**: `stage1_2378878e-ffd3-4191-a14b-56bef6df5265`
- **证据目录**: `docs/_evidence/stage1_isVerification_videoRender_20260114_204244`
- **Gate**: EXIT_CODE=0
- **核心不变量**:
  - 传播链：PIPELINE_STAGE1_NOVEL_TO_VIDEO(is_verification=false) → SHOT_RENDER×3(true) → VIDEO_RENDER(true)
  - 账本零污染：`cost_ledgers JOIN shot_jobs WHERE is_verification=true` = 0
  - 幂等一致性：拒绝复用旧非验证作业（VIDEO_RENDER_VERIFICATION_MISMATCH）
- **完整性校验**: SHA256SUMS.txt + EVIDENCE_INDEX.json
- **关键修改**:
  - `apps/api/src/job/job.service.ts`: ensureVideoRenderJob + isVerification 支持
  - `apps/api/src/job/job-report.facade.ts`: isVerification 传播
  - `apps/api/src/orchestrator/hooks/stage1-verification.hook.ts`: Mock 注入完整上下文
- **结论**: isVerification 从 SHOT_RENDER 传播到 VIDEO_RENDER 且全 SUCCEEDED；验证作业账本零污染；证据固化并可审计

---
