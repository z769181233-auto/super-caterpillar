# 全项目规格审计与状态报告 (Full Project Spec Audit & Status Report)

**审计时间**: 2026-01-11
**审计基准**: `docs/_specs` (Especially `ENGINE_MATRIX_SSOT.md`, `STAGE3_ENGINE_SPEC.md`)
**审计对象**: 核心功能链路 "Novel Import -> Video Output"

---

## 1. 总体进度概览 (Overall Progress)

### ✅ 已完成且合规 (Completed & Compliant)

1.  **基础设施 (Infrastructure)**: Monorepo 架构、SSOT 完整性、Lint/Build/Typecheck 全绿。
2.  **风控与质量 (Gate/Risk/Audit)**: Night Guard 验证通过，Risk/Audit 体系达到商业级 P0 合规。
3.  **产线后端 (Backend Pipeline)**:
    - **Shot Render**: P0-R0 封板完毕 (REAL, Local GPU/MPS).
    - **Video Merge**: P0-R1 封板完毕 (REAL, Local FFmpeg).
4.  **可观测性 (Observability)**: TraceId 全链路透传、CostLedger 计费闭环 (Stubbed Billing Events).

### ⚠️ 已完成但存在风险 (Completed with Risks)

1.  **产线前端 (Frontend Pipeline)**:
    - **CE06 (Novel Parsing)**: 状态为 **STUB** (硬编码/骨架)，未接入真实 LLM。无法解析任意小说。
    - **CE03 (Visual Density)**: 状态为 **Heuristic Stub** (关键词统计)，无 AI 理解能力。
    - **CE04 (Visual Enrichment)**: 状态为 **Heuristic Stub** (固定 Prompt 模板)，无 AI 扩写能力。

### ❌ 未完成/缺失 (Missing)

1.  **全自动编排 (Orchestration)**:
    - 目前为 **Manual Step-by-Step**。Import -> (Click) -> Analyze -> (Click) -> Render -> (Click) -> Merge。
    - 无自动触发下一阶段的 Workflow/Saga 机制，不符合 "One Click Import to Video" 的潜在商业预期。

---

## 2. 核心功能链路审计: 小说导入 -> 视频产出

| 步骤 | 功能模块           | 规格要求 (Spec)                   | 当前代码实现 (Code)                                     | 状态        | 风险等级                           |
| :--- | :----------------- | :-------------------------------- | :------------------------------------------------------ | :---------- | :--------------------------------- |
| 1    | **Novel Import**   | 解析小说文本结构 (Vol/Chap/Scene) | `ce06RealEngine` 返回硬编码 "Volume 1 / Hero enters..." | 🔴 **FAKE** | **P0 (Critical)** - 核心入口不可用 |
| 2    | **Analysis**       | 剧本分析与分镜                    | `basicTextSegmentation` (正则/句读切分)                 | 🟡 **WEAK** | P1 - 分镜质量差                    |
| 3    | **Visual Density** | 画面密度评分                      | `ce03RealEngine` (关键词统计 heuristic)                 | 🟡 **STUB** | P1 - 评分无参考价值                |
| 4    | **Enrichment**     | 提示词扩写 (SDXL Prompt)          | `ce04RealEngine` (拼接固定 Style 模板)                  | 🟡 **STUB** | P1 - 画面千篇一律                  |
| 5    | **Shot Render**    | 镜头渲染 (Image Gen)              | `processShotRenderJob` -> `engine.invoke` -> **REAL**   | 🟢 **REAL** | P0 - 合规                          |
| 6    | **Video Merge**    | 视频合成 (FFmpeg)                 | `localFfmpegProvider` (FFmpeg CLI)                      | 🟢 **REAL** | P0 - 合规                          |

> **关键结论**: 整个产线的“下半身” (Render/Merge) 是真实的、强壮的；但“上半身” (Parse/Think) 是假的。

---

## 3. 风险评估与处理方案 (Risk Mitigation)

### P0 风险: CE06 小说解析不可用

- **现状**: 无论导入什么小说，解析结果都是写死的测试数据。
- **违规项**: `ENGINE_MATRIX_SSOT.md` 定义 CE06 必须为 **REAL** (或具备真实解析能力)。
- **处理方案**: 必须接入 LLM (Gemini/GPT)。鉴于这是一个 Google Deepmind 代理项目，**最佳方案是接入 Gemini Adapter**。

### P1 风险: 缺乏自动编排

- **现状**: 用户需要手动触发每一步。
- **处理方案**: 实现 `OrchestratorService` 或在 Worker 中通过 `JobEvents` 自动触发下一阶段 (Import Success -> Trigger Analysis -> Trigger CE03/04)。

---

## 4. 下一步最佳方案 (Next Best Action)

**目标**: 打通 "Novel Import -> Video Output" 的**真实智能链路**。

### 推荐执行路径

1.  **Activate CE06 (Real)**:
    - 实现 `packages/engines/ce06/real/gemini.adapter.ts`。
    - 接入 Google Generative AI SDK。
    - 替换 `ce06RealEngine` 中的 Stub 逻辑。
2.  **Activate CE04 (Real)**:
    - 复用或激活已存在的 `gemini.adapter.ts`。
    - 让扩写真正基于小说上下文。
3.  **Pipeline Stitching**:
    - 在 `processCE06Job` 完成后，自动创建 `NOVEL_ANALYSIS` 或 `CE03` 任务。

此方案能以最小代价将当前的 "Skeleton Pipeline" 升级为 "AI-Powered Pipeline"，符合商业交付标准。
