# Phase 5A: REAL VIDEO PASS 审计封板任务清单

- [x] STAGE 0 — 基线固化与污染清场 <!-- id: 10 -->
- [x] STAGE 1 — 真实渲染改造 (移除 2x2 占位) <!-- id: 11 -->
- [x] STAGE 2 — 启动 ComfyUI 并验证连通性 <!-- id: 12 -->
- [x] STAGE 3 — 启动生产级 Worker 并验证消费力 <!-- id: 13 -->
- [x] STAGE 4 — 端端 Image Gate (真实图片产出) <!-- id: 14 -->
- [x] STAGE 5 — 真实视频产出验证 (mp4 + ffprobe) <!-- id: 15 -->
- [x] STAGE 6 — 路径泄露检查 <!-- id: 16 -->

## 审计封板与收口交付 (STAGE F0 - F4)

- [x] STAGE F0 — 证据封存索引 (EVIDENCE_INDEX.json) <!-- id: 17 -->
    - [x] 遍历证据目录生成 SHA256 校验和
    - [x] 生成 `EVIDENCE_INDEX.json`
- [x] STAGE F1 — 最终产物前缀 SSOT 对齐 (final=videos/) <!-- id: 18 -->
    - [x] 修改 `VIDEO_RENDER` 最终落盘路径由 `renders/` 收口至 `videos/`
    - [x] 更新资产 `storageKey` 为 `videos/` 前缀
    - [x] 增加最终产物断言：`find .runtime/videos -name "*.mp4"`
- [x] STAGE F2 — 门禁硬化收口 <!-- id: 19 -->
    - [x] `gate-shot-render-real-assert.sh` 增加像素方差阈值校验 (防纯色)
    - [x] `gate-prod_slice_v1_real.sh` 同步断言 `videos/` 产物及 `ffprobe`
- [x] STAGE F3 — 任务清单与 Walkthrough 收口 (最终产物 prefix=videos/) <!-- id: 20 -->
    - [x] `task.md` 补齐说明
    - [x] `walkthrough.md` 新增“审计裁决摘要”段落
- [x] STAGE F4 — Git Tag/封板声明 (seal/phase5A_real_video_pass_20260116_v3) <!-- id: 21 -->
    - [x] 执行 `git tag seal/phase5A_real_video_pass_20260116_v3`
