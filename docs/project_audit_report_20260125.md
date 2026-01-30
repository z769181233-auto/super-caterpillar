# 毛毛虫宇宙 (Super Caterpillar) 项目审计与规划报告

**日期**: 2026-01-25
**依据**: `docs/_specs` 全集、SSOT 矩阵、代码库现状、测试证据
**目标状态**: 全自动化产出商业级视频 (Real Video Production)

---

## 1. 项目总进度评估

| 维度                    | 进度     | 状态评价                                                                                            |
| :---------------------- | :------- | :-------------------------------------------------------------------------------------------------- |
| **核心引擎 (Engines)**  | **100%** | ✅ **SEALED**. 文本、视觉、合成三大引擎已达 L2 生产级封板。音频引擎 (Audio) 服务就绪，但未入 SSOT。 |
| **基础设施 (Infra)**    | **90%**  | ✅ **HARDENED**. 鉴权(Auth)、治理(P25)、计费(Billing)、限流(RateLimit) 均已由 STAGE 7 验证闭环。    |
| **编排管线 (Pipeline)** | **50%**  | 🔄 **IN PROGRESS**. “无声视频”管线 (V1) 已通 MVP 测试，但 **Audio** 环节尚未集成进自动化 DAG。      |
| **商业化与运营**        | **30%**  | ⏳ **PENDING**. 支付、C端用户体系、增长配套尚处于早期 Stub 或 Spec 阶段。                           |

**总体完成度**: **~70%** (技术侧已接近 90%，距离“一键成片”的产品闭环仅差“音频串联”这最后一公里)。

---

## 2. 真实视频产出能力合规性分析

以 **PRD V3.0** 及 **Pipeline Spec** 为基准，对比当前实现：

### ✅ 已符合 (Compliant)

1.  **Novel Parsing (CE06)**: 3M 字超长文本解析已验证，稳定可靠。
2.  **Visual Chain (CE03/04/Render)**:
    - 密度评分 (Density)、扩写 (Enrichment)、生图 (Shot Render) 链路已完全打通。
    - 验证依据: `gate-prod_slice_v1_real.sh` 中的 `Implied DAG` 逻辑。
3.  **Video Assembly (Video Merge)**:
    - FFmpeg 硬拼接、转场处理、水印 (CE09) 集成已就绪。
    - 验证依据: `gate-prod_slice_v1_real.sh` 已包含 `CE09` 调用。

### ❌ 不符合 / 未完成 (Non-Compliant / Gaps)

1.  **Audio Integration (Critical Gap)**:
    - **现状**: 尽管 `AudioService` (TTS/Mixing) 已通过 `gate-audio-p18-6-final.sh` 单点测试，但 **Orchestrator 中不存在 Audio 相关的 DAG 逻辑**。目前的 V1 Pipeline 产出的是 **无声视频** (Silent Video)。
    - **差异**: Spec 要求 Novel -> TTS -> Audio Segments -> Timeline Alignment。目前缺失这一环。
2.  **Pipeline Automation v1**:
    - **现状**: SSOT 中状态为 `PLAN`。虽然脚本能跑通，但属于 "Scripted Orchestration" 而非 "System Orchestration"。`orchestrator.service.ts` 的 `handleJobCompletion` 仅处理了 `SHOT_RENDER -> VIDEO_RENDER`，缺乏对 Audio 任务的触发和汇聚。
3.  **Cost consistency**:
    - 大规模并发下，Pipeline 级的成本汇总（Cost Rollup）尚未经过 P25 级别的审计验证。

---

## 3. 风险与优化 (Risks & Optimizations)

### 🔴 高风险 (High Risk)

1.  **Pipeline Asynchrony**: 音频生成与视频生成的时长不匹配风险。若 TTS 生成慢于图像，会导致合成时 Timeline 错位。目前因 Orchestrator 缺失 Audio 逻辑，无法自动对齐（Alignment）。
2.  **Resource Contention**: 引入 Audio/TTS 后，Runner 的并发压力将倍增。P25 解决了 3M Words 解析的内存问题，但未测试音频 IO 密集操作下的稳定性。

### 🟡 需要优化 (Optimizations)

1.  **Orchestrator V2 Upgrade**: 需要从简单的 `handleJobCompletion` 回调模式升级为真正的 **DAG 状态机**，支持并发分支（Video Branch + Audio Branch）后再汇聚 (Join)。
2.  **SSOT Integrity**: 必须将 Audio Engine 正式纳入 `ENGINE_SEAL_MATRIX_SSOT.md`，并在 Gate 生成器中支持 Audio 类型的脚本。

---

## 4. 后续工作计划 (Roadmap to Real Video)

为实现“真实有声视频产出”，建议按以下顺序推进：

### PHASE 1: Audio Engine Seal (立即执行)

- **Task**: 将 Audio Engine 纳入 SSOT 体系。
- **Action**:
  - 补全 `docs/ENGINE_SEAL_MATRIX_SSOT.md` 中的 Audio 条目。
  - 固化 `gate-audio-p18-6-final.sh` 为标准 L2 Gate。

### PHASE 2: Orchestrator V2 (Pipeline Integration)

- **Task**: 实现 Novel -> Video/Audio 并行 DAG。
- **Action**:
  - 升级 `OrchestratorService`：
    - 新增 `checkAndSpawnAudioGen` (Novel -> TTS)。
    - 新增 `Sync Barrier`：同时等待 `SHOT_ARRAYS` 和 `AUDIO_TRACKS` 就绪。
    - 升级 `VIDEO_MERGE` Payload，注入 Audio Assets 路径。
  - 更新 `gate-prod_slice_v1_real.sh`，加入对 Audio Job 的断言。

### PHASE 3: Pipeline V1 Seal (最终闭环)

- **Task**: 封板全自动管线。
- **Action**:
  - 运行升级后的 Slice Gate。
  - 验收最终产出的 MP4 (包含画面 + 声音 + 水印)。
  - 将 `pipeline_prod_video_v1` 在 SSOT 中从 `PLAN` 晋升为 `SEALED`。

**一句话总结**: 引擎已备好，只是还没把“声音”编织进“画面”里。接下来的核心战役是 **Orchestrator V2**。
