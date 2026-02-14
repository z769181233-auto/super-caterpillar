# Implementation Plan - Phase 2 (B-Series): Quality & Intelligence

## 1. 概述
Phase 2 (B 系列) 旨在 Phase 1 (A 系列) 端到端链路贯通的基础上，进一步提升内容的**深度分析能力**、**视觉一致性**以及**系统调度效率**。

## 2. 核心任务拆分

### B1: 多 Agent 协作的小说深度分析 (Multi-Agent Novel Analysis)
- **目标**: 升级 `CE06_NOVEL_PARSING` 引擎，从单次 LLM 调用升级为多角色 Agent 协作模式。
- **子任务**:
  - [ ] **B1-1**: 定义 Agent 角色 (Writer, Director, Auditor)。
  - [ ] **B1-2**: 实现 Orchestrator 逻辑，支持串行/并行 Agent 调用。
  - [ ] **B1-3**: 集成人物一致性检查 (Character Audit) 环节。
- **验证**: 使用 2 万字以上小说进行压力与质量双重测试。

### B2: 全局视觉风格锁定 (Visual Style-Locking)
- **目标**: 确保同一个项目产生的视频在色调、构图风格和人物特征上保持高度一致。
- **子任务**:
  - [ ] **B2-1**: 在 `Project` 模型中增加 `style_guide` 持久化字段。
  - [ ] **B2-2**: 升级 `CE04_VISUAL_ENRICHMENT` 引擎，支持从 Project 继承全局 Prompt。
  - [ ] **B2-3**: 支持在渲染阶段注入全局 Lora 或 IP-Adapter 权重。
- **验证**: 生成 3 个互不相邻的 Scene 视频，通过视觉比对确认风格一致性。

### B3: 分布式节点调度与资源感知优化
- **目标**: 提升 Worker 集群在高并发状态下的响应速度与稳定性。
- **子任务**:
  - [ ] **B3-1**: 优化 BullMQ 轮询机制，减少任务拾取延迟。
  - [ ] **B3-2**: 实现 Worker 负载上报与动态调节。
  - [ ] **B3-3**: 增强 Artifact 存储后的事件通知实时性。
- **验证**: 通过 `gate-stage4-scale.sh` 再次验证并发处理耗时下降 > 20%。

## 3. 风险管理 (Risk Registry)

| 风险 ID | 描述 | 等级 | 应对方案 |
| :--- | :--- | :---: | :--- |
| **R-P0-04** | 多 Agent 调用导致 Token 成本激增 | P0 | 引入 BudgetGuard 控制分析深度 |
| **R-P1-01** | 全局 Lora 注入导致渲染失败 | P1 | 增加渲染前的资产完整性 Check |

## 4. 进度安排 (Milestones)
- **Week 1 (B1 & B2 Foundation)**: 完成代码重构与字段扩展。
- **Week 2 (Integration & B3 Optimization)**: 多节点联调与性能调优。
- **Final (Phase 2 Seal)**: 通过全量门禁回归。

---
**Approval Status**: 🟢 Ready for Execution
