# Stage-2 启动入口：调度骨架最小闭环

**前置条件**: Stage-1 已封板（✅ tag: `seal_stage1_s1-sec-patch_20260114`）

---

## Stage-2 范围定义

按照《开发执行顺序说明书》，Stage-2 专注于 **Render Orchestrator / Worker 心跳与注册 / 队列调度 / 引擎统一入口**。

**核心原则**:
- ✅ 只做调度层基础设施（Worker 生命周期管理、任务分发）
- ❌ 不碰 CE 内容引擎实现（CE01-CE10 留待后续阶段）
- ✅ 确保"调度骨架"可审计、可复现、可扩展

---

## S2-ORCH-BASE: 最小可用闭环

### 目标
建立 Worker 与 API 之间的调度通信基座，实现：
1. Worker 自报能力（Register）
2. API 记录 Worker 心跳（Heartbeat）
3. Worker 拉取任务（FetchJob）
4. Worker 确认/完成任务（Ack/Complete）

### 不做的事情
- ❌ 不实现任何 CE 引擎逻辑（图像生成、视频合成等）
- ❌ 不修改数据库 Schema（复用现有 `Worker`, `ShotJob` 等表）
- ❌ 不引入新的外部依赖

---

## 实现计划骨架

### Phase 2-A: Worker 注册与心跳
**文件修改范围**:
- `apps/api/src/worker/worker.service.ts`: 实现 `registerWorker()`, `updateHeartbeat()`
- `apps/api/src/worker/worker.controller.ts`: 暴露 `POST /api/workers/register`, `POST /api/workers/:id/heartbeat`
- `apps/workers/src/gate/gate-worker-app.ts`: 实现心跳上报逻辑

**验证目标**:
- Worker 启动后自动注册
- 每 N 秒发送心跳
- API 记录 Worker `lastHeartbeat` 时间戳

### Phase 2-B: 任务分发与拉取
**文件修改范围**:
- `apps/api/src/worker/worker.service.ts`: 实现 `fetchNextJob(workerId)`
- `apps/api/src/job/job.service.ts`: 实现任务队列逻辑（按优先级/FIFO）
- `apps/workers/src/gate/gate-worker-app.ts`: 实现轮询拉取逻辑

**验证目标**:
- Worker 通过 `GET /api/workers/:id/jobs/next` 获取任务
- 任务状态从 `PENDING` → `CLAIMED` (带 Worker ID)
- 无任务时返回 204 No Content

### Phase 2-C: 任务确认与完成
**文件修改范围**:
- `apps/api/src/job/job.service.ts`: 实现 `ackJob()`, `completeJob()`
- `apps/workers/src/gate/gate-worker-app.ts`: 实现 ack/complete 上报

**验证目标**:
- Worker 调用 `POST /api/jobs/:id/ack` 确认任务
- Worker 调用 `POST /api/jobs/:id/complete` 标记完成
- 任务状态最终流转：`PENDING` → `CLAIMED` → `RUNNING` → `SUCCEEDED`/`FAILED`

---

## Gate 验证设计

**Gate 脚本**: `tools/gate/gates/gate-s2-orch-base.sh`

**验证流程**:
1. 启动 API 服务
2. 启动 Mock Worker (仅上报心跳，不执行真实任务)
3. 通过 API 创建一个 Mock Job
4. 验证 Worker 拉取到该 Job
5. 验证 Worker 上报 Ack + Complete
6. 检查数据库：Job 状态为 `SUCCEEDED`，Worker 记录存在

**负测**:
- Worker 心跳超时后被标记为 `OFFLINE`
- 重复 Ack 同一 Job 返回幂等响应
- Worker 拉取不属于自己能力范围的 Job 返回 403

---

## 下一步行动

1. **创建 S2 Implementation Plan**: 详细设计 API 路由、数据库查询、Worker 状态机
2. **执行 Phase 2-A**: 实现 Worker 注册与心跳
3. **执行 Phase 2-B**: 实现任务分发与拉取
4. **执行 Phase 2-C**: 实现任务确认与完成
5. **开发 Gate 验证**: 编写 `gate-s2-orch-base.sh`
6. **封板 S2-ORCH-BASE**: 通过 Gate 验证后打 tag `seal_stage2_orch_base_YYYYMMDD`

---

**预计工作量**: 中等（约 10-15 次工具调用）  
**前置依赖**: Stage-1 已封板 ✅  
**成功标准**: Gate 通过 + 证据归档 + Git Tag

---

**创建时间**: 2026-01-14T01:06:00+07:00  
**参考文档**: 《开发执行顺序说明书》Stage-2 定义
