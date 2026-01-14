# Super Caterpillar Engine Seal Index (SSOT)

> [!IMPORTANT]
> **Audit Hardware Specification V2 (工业级审计规格)**
> 所有从 P0-R1 起的引擎封板必须产出以下证据链：
>
> 1. `REQ.json`: 原始请求 Payload（含 Trace/Job/Dedupe 元数据）
> 2. `RUN.json`: 完整 API 响应 JSON（含 selectedEngineKey, audit_trail, metrics）
> 3. `RUN_ID.txt`: 唯一的 JobID/RunID（用于快速二次审计）
> 4. `SQL_JOB.json`: 数据库中采集到的 job 状态行（含 is_verification 标识）
> 5. `SQL_LEDGER.json`: 关联 Trace 的账本写入情况（必须为 0）
> 6. `SUMMARY.md`: 自动化生成的通过性摘要
> 7. `SHA256SUMS.txt`: 所有文件的哈希校验和（防篡改）

---

### Phase 0-R4: CE02 Mother -> VIDEO_RENDER (Real FFmpeg) Seal

- **封板日期**: 2026-01-14
- **Tag**: `seal/p0_r4_ce02_video_render_real_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-p0-r4_ce02_video_render_real.sh`
- **证据目录**: [p0_r4_ce02_video_render_real_20260114_233702](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r4_ce02_video_render_real_20260114_233702/)
- **规格**: Audit V2
- **核心不变量**:
  - 母引擎入口：通过 CE02 统一接口调用 `video_merge` (JobType: VIDEO_RENDER)
  - 产物真实性：调用底层 FFmpeg 引擎，成功合成 100x100 MP4 视频资产
  - 幂等性验证：连续两次带 `dedupeKey` 调用，验证 API 层/引擎层不稳定性拦截
  - 账本隔离：`isVerification=true` 且 `cost_ledgers` 零写入
- **结论**: P0-R4 TOTAL PASS；视频合成节点真实链路封板；FFmpeg 工业化调度验证通过。

---

### Phase 0-R1: CE02 Mother -> CE06 Real (Novel Parsing) Seal

- **封板日期**: 2026-01-14
- **Tag**: `seal/p0_r1_ce02_ce06_real_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-p0-r1_ce02_ce06_real.sh`
- **证据目录**: [p0_r1_ce02_ce06_real_v2_20260114_233531](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r1_ce02_ce06_real_v2_20260114_233531/)
- **规格**: Audit V2 (Upgraded)
- **母引擎定义**: Mother Engine = **CE02**
- **核心不变量**:
  - 母引擎入口：通过 CE02 统一接口调用 `ce06_novel_parsing`
  - 产物真实性：返回解析后的结构化小说数据（Chapters/Scenes/Volumes）
  - 账本隔离：`isVerification=true` 且 `cost_ledgers` 零写入
  - 审计轨迹：`audit_trail` 完整记录了底层引擎版本
- **结论**: P0-R1 TOTAL PASS；证据链已升级为 V2 规格。

---

### Phase 0-R2: CE02 Mother -> CE03 Real (Visual Density) Seal

- **封板日期**: 2026-01-14
- **Tag**: `seal/p0_r2_ce02_ce03_real_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-p0-r2_ce02_ce03_real.sh`
- **证据目录**: [p0_r2_ce02_ce03_real_v2_20260114_233532](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r2_ce02_ce03_real_v2_20260114_233532/)
- **规格**: Audit V2 (Upgraded)
- **母引擎定义**: Mother Engine = **CE02**
- **核心不变量**:
  - 母引擎入口：通过 CE02 统一接口调用 `ce03_visual_density`
  - 产物真实性：返回计算后的视觉密度评分 (visual_density_score)
  - 账本隔离：`isVerification=true` 且 `cost_ledgers` 零写入
- **结论**: P0-R2 TOTAL PASS；证据链已升级为 V2 规格。

---

### Phase 0-R3: CE02 Mother -> CE04 Real (Visual Enrichment) Seal

- **封板日期**: 2026-01-14
- **Tag**: `seal/p0_r3_ce02_ce04_real_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-p0-r3_ce02_ce04_real.sh`
- **证据目录**: [p0_r3_ce02_ce04_real_v2_20260114_233533](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r3_ce02_ce04_real_v2_20260114_233533/)
- **规格**: Audit V2 (Upgraded)
- **母引擎定义**: Mother Engine = **CE02**
- **核心不变量**:
  - 母引擎入口：通过 CE02 统一接口调用 `ce04_visual_enrichment`
  - 产物真实性：返回扩写后的视觉提示词 (enriched_prompt)
  - 账本隔离：`isVerification=true` 且 `cost_ledgers` 零写入
- **结论**: P0-R3 TOTAL PASS；证据链已升级为 V2 规格。

---

### Phase 0-R0: Mother Engine -> SHOT_RENDER Real Engine Seal

- **封板日期**: 2026-01-14
- **Tag**: `seal/p0_r0_mother_shot_render_real_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-p0-r0_mother_shot_render_real.sh`
- **证据目录**: `docs/_evidence/p0_r0_mother_shot_render_real_20260114_225032/`
- **母引擎定义**: Mother Engine = **CE02**
- **核心不变量**:
  - 母引擎入口：`POST /api/_internal/engine/invoke` 带 JWT 鉴权
  - 真实集成：`ShotRenderLocalAdapter` 调用 `@scu/engines-shot-render` (sd15-mps-pil-shim)
  - 隔离保护：`isVerification=true` 强制不入账 (`cost_ledgers`)
- **结论**: P0-R0 TOTAL PASS。

---

### Stage 3: Event-Driven DAG + Multi-Worker Concurrency (Gate S3 Hardened)

- **封板日期**: 2026-01-14
- **Tag**: `seal/stage3_s3_gate_hardened_20260114`
- **Gate 脚本**: `tools/gate/gates/gate-s3-scale-event-dag.sh`
- **结论**: Gate S3 TOTAL PASS。

---

### Stage 1: isVerification 验证链路封板（SHOT_RENDER → VIDEO_RENDER 传播）

- **封板日期**: 2026-01-14
- **Tag**: `seal/stage1_isVerification_videoRender_20260114`
- **结论**: isVerification 传播链验证通过。

---
