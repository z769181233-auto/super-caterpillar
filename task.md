# 任务列表 (Task List) - 真实内容 Provider 全接入

- [x] **P0. 硬前提与污染治理**
  - [x] 修改 `run_production_pilot.ts` 实现动态 `PROJECT_ID`
  - [x] 治理根目录调试文件污染（检查并清理 CE06 等 processor）
  - [x] 锁死 `TimelineRender`：强制要求 `AssetType.VIDEO`，禁止兜底

- [x] **P1. 接入 ComfyUI（图片生成）**
  - [x] 创建 `tools/prod/comfyui_client.ts` 通用客户端
  - [x] 修改 `tools/prod/run_character_turnaround.ts`：连通 ComfyUI + 落库 Asset
  - [x] 修改 `CE04_VISUAL_ENRICHMENT`：生成 `keyframe.png` + 落库 Asset + 写入 `frames.txt`

- [x] **P2. ShotRender 2.5D 化（真画面可动）**
  - [x] 修改 `shot-render.local.adapter.ts`：使用 `keyframe.png` + `zoompan` 产出 `source.mp4`
  - [x] 增加视频质量基础验证（Size, Duration, Blackdetect）

- [x] **P3. Timeline 高质量合成**
  - [x] 确保 `TimelineCompose` 只引用真实 VIDEO 资产
  - [x] 固定 `TimelineRender` 生产级编码参数 (1080p, crf 18, 4M)

- [x] **P4. 门禁与非占位符校验**
  - [x] 编写 `tools/gate_non_placeholder_video.sh`
- [x] P5. 崩溃自愈与深度修复 (Stability & Self-Healing)
  - [x] 修复端口冲突 (Port 3000/3001/8188)
  - [x] 重建 Prisma 客户端并同步 Schema
  - [x] ComfyUI CLIP 加载异常绕过方案实现
  - [x] 恢复全服务自愈启动链路

## Phase 6: 生产级极限压测与引擎真化 (Production Benchmarking)

- [x] **P6-0: 15M 字级导入极限压测 Gate (Massive Import)**
  - [x] P6-0-0: 基线与证据目录 (Evidence Dir) [docs/_evidence/p6_0_massive_import_seal_20260204_233835]
  - [x] P6-0-1: 协议升级 (Storage Ref + Stream, No JSON Body)
  - [x] P6-0-2: 安全闭环 (HMAC + X-Content-SHA256 Double Verify)
  - [x] P6-0-3: 业务修复 (Fix Chapter Not Found)
  - [x] P6-0-4: Gate 升级 (Process Health + Metrics Snapshot)
  - [x] P6-0-5: 负向测试 (Security Degradation Check)
  - [x] P6-0-6: 封板 (Artifacts Seal) [shasum verified]
- [x] **P6-1: Billing Ledger 对账 Gate (Billing Reconciliation)**
  - [x] P6-1-0: 证据目录与 SSOT 冻结
  - [x] P6-1-1: 实现对账脚本 `reconcile_billing.ts`
  - [x] P6-1-2: 实现 Gate 脚本 `gate_billing_reconciliation.sh`
  - [x] P6-1-3: 实现负向测试 `gate_billing_negative.sh`
  - [x] P6-1-4: 封板 (Sealed with Checksums)
- [x] **P6-2: Stage 4 Scaling 封板 (15M Real Novel Seal)**
  - [x] P6-2-0: 正向测试 `gate-stage4-scale-wangu.sh` (15M字真实小说测试通过)
  - [x] P6-2-1: 动态并发调优 (负载 > 0.8 或 内存 < 512MB 时自动降级)
  - [x] P6-2-2: 级联触发限流 (Dispatch Rate Limiting + Priority Jitter)
  - [x] P6-2-3: 封板 `seal/shredder_v1_wangu_20260214`
- [ ] **Phase 2: 质量与智性提升 (Quality & Intelligence - B Series)**
  - [x] **B1: 多 Agent 协作的小说深度分析**
    - [x] 设计 Agent 编排逻辑 (Writer/Director/Auditor)
    - [x] 实现角色分工与 Mock 验证 (Gate Passed)
  - [x] **B2: 全局视觉风格锁定 (Style-Locking)**
    - [x] Project 模型字段扩展 (Schema Verified)
    - [x] 增强 Visual Enrichment 继承逻辑 (Verified with gate-b2)
  - [x] **B3: 调度优化与资源感知**
    - [x] Adaptive Polling (Verified with gate-b3)
    - [x] System Load Monitoring & Throttling
