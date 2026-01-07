# 引擎系统唯一入口规范 (Engine SSOT Architecture)

## 1. 核心定义
为消除“引擎三头政治”导致的架构漂移，本项目强制规定唯一的引擎访问入口。

*   **唯一合法入口**: `apps/api/src/engine-hub/engine-invoker-hub.service.ts`
*   **适配器定义**: `apps/api/src/engine-hub/adapters/`

---

## 2. 废弃与隔离政策 (Deprecation & Isolation)

| 目录 | 状态 | 政策 |
| :--- | :--- | :--- |
| `apps/api/src/engine/` | **DEPRECATED** | 仅允许被 `JobModule` 及其它基座核心引用。禁止在 Stage 3+ 业务逻辑中直接调用。 |
| `apps/api/src/engines/` | **DEPRECATED** | 进入只读冻结状态。严禁在此处新增任何适配器或逻辑变更。 |
| `apps/api/src/engine-hub/` | **SSOT** | 所有的 Stage 3 真实引擎（CE06, CE03/04, CE07 等）必须通过此处进行统一适配与下发。 |

---

## 3. 强制门禁规则 (Gate Rules)

### 3.1 禁止跨越枢纽 (Hub Bypass Prohibition)
- **校验点**: `tools/gate/gates/gate-engine_entry_ssot.sh`
- **规则**: 在 `apps/api/src/` 下除了 `engine-hub` 之外的任何新建模块中，若检测到 `import ... from '../engine/'` 或 `import ... from '../engines/'`，门禁将被阻断（FAIL）。

### 3.2 离散化认领规则
- 所有引擎调用禁止在 Controller 层同步执行。
- 必须遵循：`Controller -> JobService.create -> Worker -> engine-hub` 链路。

---

## 4. 迁移路径
1.  **Stage 3 P1**: 先行将 CE06, CE07 的调用对齐到 `engine-hub`。
2.  **Stage 4**: 启动全量重构，将 `src/engine` 下的基座能力彻底并入 `engine-hub`，最终物理删除 `src/engine` & `src/engines`。

---

**生效日期**: 2026-01-05 (Stage 3 启动点)
**执行标准**: `LAUNCH_STANDARD_V1.1`
