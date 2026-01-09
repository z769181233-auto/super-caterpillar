# Production V0 Readiness Report (生产环境 V0 就绪评估报告)

**Date**: 2025-12-18
**Mode**: RESEARCH
**System**: Super Caterpillar Universe

## 1. 核心结论 (Executive Summary)

- **Production V0 就绪状态**: **NO (未就绪)**
- **最大阻碍 (Blockers)**:
  1.  **AI 引擎缺失**: "小说分析引擎" 目前仅为正则切片器，无法生成有意义的分镜结构，导致生产链路虽通但无内容。
  2.  **资产安全漏洞**: `Asset` 表缺失 `signed_url` 等关键安全字段，存在资源裸奔风险 (Stage 1 Gap)。
  3.  **链路脆弱**: 视频渲染 Worker 仅支持本地文件/简单拼接，缺乏复杂的错误恢复和流式处理能力。

- **上线可行性分析**:
  - **全自动模式**: **不可用** (因引擎缺失)。
  - **人工/模板模式**: **勉强可用** (但需手动构造数据库结构或使用极其严格格式的文本)。

## 2. 模块详细核查 (Module Audit)

### 2.1 平台架构 (Platform Architecture)

- **API**: ✅ NestJS 模块化结构完整，包含 Auth, Throttling, Logging。
- **Worker**: ✅ 基于 Redis/BullMQ 的 Worker 模型已建立。
- **Task**: ✅ `Task` -> `ShotJob` -> `WorkerJob` 三层调度模型已存在。
- **评价**: 架构骨架因 Stage 1-2 的工作已相对成熟，适合 V0 上线。

### 2.2 DB 层级模型 (Database Model)

- **结构**: ✅ `Project` -> `Season` -> `Episode` -> `Scene` -> `Shot` 完整。
- **V1.1 对齐**: ⚠️ `Asset` 表缺失关键字段 (P0 风险)。
- **评价**: 核心内容结构完备，但周边支撑表 (Asset) 需补丁。

### 2.3 视频生产链路 (Video Pipeline)

- **代码**: `apps/workers/src/video-render.processor.ts`
- **逻辑**: FFmpeg `concat` 模式。
- **缺陷**:
  - 输入必须是本地文件 (`LocalStorageAdapter`)。
  - 缺乏资产预下载/缓存机制 (假设文件已在 `storageRoot`)。
  - **P1 风险**: 在分布式 Worker 环境下，如果 Storage 未共享挂载，渲染将直接失败。

### 2.4 安全 (Security)

- **API 签名**: ✅ `HmacAuthGuard`, `TimestampNonceGuard` 已部署。
- **防重放**: ✅ `NonceStore` 存在。
- **资产安全**: ❌ `Asset` 模型未就绪。
- **评价**: 接口层安全达标，数据层/资产层安全未达标。

### 2.5 并发与限流 (Concurrency & Limits)

- **限流**: ✅ `ThrottlerModule` (Global, 100 req/min)。
- **并发**: Worker 依赖 BullMQ 并发控制。
- **评价**: V0 阶段够用。

### 2.6 成本控制 (Cost Control)

- **模型**: `CostCenter`, `BillingEvent`, `Organization.quota` 存在。
- **逻辑**: 需要确认 `BillingModule` 是否真正拦截任务。
- **评价**: 数据模型支持，但逻辑可能仅为 "记账" 而非 "硬控"。

### 2.7 可观测性 (Observability)

- **日志**: ✅ `nestjs-pino` (JSON logs)。
- **Metrics**: ⚠️ 仅基础 Health Check，缺乏 Prometheus/Grafana 深度集成。
- **评价**: 勉强及格。

## 3. 关键问题回答 (Key Answers)

### Q1: 当前“小说分析引擎”是否适合作为上线生产依赖？

**回答: 否 (NO)。**
当前实现仅为 `Regex Splitter`。它产出的 "Shot" 是一句话，产出的 "Scene" 是一段话，完全没有分镜所需的 "画面描述 (Prompt)"、"运镜 (Camera)"、"人物 (Character)" 信息。直接依赖它生成的视频将是没有任何画面的黑屏或纯文字。

### Q2: 当前系统是否可在“模板/人工修订输入”模式下稳定生产视频？

**回答: 理论可行，实际困难。**
如果运营人员直接操作数据库或通过 API 也就是手动一个个创建 Shot 并填入 `Asset` 关联，那么 Video Render Worker 可以工作。
但系统目前**缺乏 "分镜编辑器" (Storyboard Editor)** 的 API 或 UI 支持，纯靠人工通过 DB 注入数据极其痛苦且易错。

## 4. 结论 (Conclusion)

系统处于 **"架构就绪，大脑缺失"** 的状态。

- 骨架 (API/DB/Worker) 是好的。
- 肌肉 (Video Render) 是有的。
- 大脑 (Novel Engine / Shot Reasoner) 是空的。

**不建议在当前状态下进行 Production V0 发布**，除非仅作为 "技术验证 Demo" (即人工上传图片合成视频，不涉及小说分析)。
