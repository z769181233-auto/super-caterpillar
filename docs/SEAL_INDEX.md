# Super Caterpillar Engine Sealing Index (SSOT)

本文档记录了毛毛虫宇宙 (Super Caterpillar) 所有通过工业级门禁 (Industrial Gate) 验证并封板的引擎节点。

---

## 审计规格标准 (Audit Standards)

### Audit V2 (Hardened)

- **Zero-Python**: 门禁脚本必须自解藕，仅依赖 Node.js/FFmpeg/psql，移除 Python pillow 等脆弱环境依赖。
- **产物硬断言**: 视频类产物强制执行 `ffprobe` 校验 (duration > 0)，严禁 dummy fallback 逃逸。
- **审计双路兼容**: 审计证据采集必须兼容 `details` 与 `payload` 路径，确保分布式追踪链条 100% 覆盖。
- **幂等性强断言**: 强制比较多次调用产物的 URI 签名，失败则拒绝封板。
- **账本隔离**: `isVerification=true` 时 `cost_ledgers` 必须为 0 写入。

---

## Phase 0: Real Engine Sealing (工业级真实集成)

### Phase 0-R1: CE02 Mother -> CE06 Real (Novel Parsing)

- **封板日期**: 2026-01-14
- **证据目录**: [p0_r1_ce02_ce06_real_v2h_20260114_235250](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r1_ce02_ce06_real_v2h_20260114_235250)
- **规格**: Audit V2 Hardened
- **核心结论**: 成功提取分卷/章节/场景结构，审计日志 dual-path 采集成功，账本隔离验证通过。

### Phase 0-R2: CE02 Mother -> CE03 Real (Visual Density)

- **封板日期**: 2026-01-14
- **证据目录**: [p0_r2_ce02_ce03_real_v2h_20260114_235251](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r2_ce02_ce03_real_v2h_20260114_235251)
- **规格**: Audit V2 Hardened
- **核心结论**: 成功计算视觉密度评分，审计证据链完整，无账本污染。

### Phase 0-R3: CE02 Mother -> CE04 Real (Visual Enrichment)

- **封板日期**: 2026-01-14
- **证据目录**: [p0_r3_ce02_ce04_real_v2h_20260114_235251](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r3_ce02_ce04_real_v2h_20260114_235251)
- **规格**: Audit V2 Hardened
- **核心结论**: Gemini 扩写提示词通过，审计及隔离特性符合 V2 Hardened 标准。

### Phase 0-R4: CE02 Mother -> VIDEO_RENDER Real (Merge)

- **封板日期**: 2026-01-14
- **证据目录**: [p0_r4_ce02_video_render_real_v2h_20260114_235225](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/\_evidence/p0_r4_ce02_video_render_real_v2h_20260114_235225)
- **规格**: Audit V2 Hardened
- **核心断言**:
  - `ffprobe` Duration > 0: ✅ (Verified 0.16s)
  - Idempotency Match: ✅ (uri1 == uri2)
  - Python-Free Index: ✅
  - Business Realness: 已激活真实 FFmpeg 链路，产出合法 MP4 资产。

---

### Phase 0-R0: Mother Engine -> SHOT_RENDER Real Engine

- **封板日期**: 2026-01-14
- **证据目录**: `docs/_evidence/p0_r0_mother_shot_render_real_20260114_225032/`
- **结论**: P0-R0 TOTAL PASS。核心不变量验证完成。

---

## 历史里程碑 (Archived Milestones)

- **Stage 3**: 事件驱动 DAG 与多 Worker 负载均衡封板 (2026-01-14)
- **Stage 1**: `isVerification` 传播链与视频渲染流程验证 (2026-01-14)
- **CE-ARCH-GUARD-02**: 引擎调用界面 SSOT 门禁通过 (2026-01-10)
