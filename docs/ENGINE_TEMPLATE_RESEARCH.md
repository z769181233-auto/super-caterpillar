# 引擎母版 RESEARCH 结论

> **日期**: 2026-01-09  
> **搜索范围**: 全仓库  
> **结论**: ❌ **显式母版不存在**，但存在**事实母版模式**

---

## 1. 搜索结果汇总

### 1.1 关键词搜索

| 关键词                                         | 结果        |
| ---------------------------------------------- | ----------- |
| `engine.?template` / `template.?engine`        | ❌ 无匹配   |
| `engine.?skeleton` / `scaffold`                | ❌ 无匹配   |
| `母版` / `引擎母版` / `脚手架`                 | ❌ 无匹配   |
| `createEngine` / `newEngine` / `EngineFactory` | ❌ 无匹配   |
| `EngineRegistry` / `EngineAdapter`             | ✅ 多处匹配 |

### 1.2 引擎相关目录

```
packages/engines/
├── ce03/         (5 files: index.ts, types.ts, selector.ts, real.ts, replay.ts)
├── ce04/         (7 files)
├── ce06/         (5 files: index.ts, types.ts, selector.ts, real.ts, replay.ts)
└── shot_render/  (10 files: 含 providers/ 子目录)
```

---

## 2. 事实母版模式

虽无显式母版文件，但 **每个引擎遵循统一结构**：

| 文件          | 职责                           | 母版特征 |
| ------------- | ------------------------------ | -------- |
| `types.ts`    | I/O 类型定义 + `billing_usage` | ✅ 必备  |
| `selector.ts` | REAL/REPLAY 模式切换           | ✅ 必备  |
| `real.ts`     | 真实引擎实现                   | ✅ 必备  |
| `replay.ts`   | 确定性重放（测试用）           | ⚠️ 可选  |
| `index.ts`    | 统一导出                       | ✅ 必备  |
| `providers/`  | 多后端抽象（如 SHOT_RENDER）   | ⚠️ 可选  |

### 2.1 类型规范（来自 ce06/types.ts）

```typescript
export interface EngineBillingUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
}

export interface CE06Output {
    // ... 业务字段
    billing_usage: EngineBillingUsage; // Stage-3-B 强制字段
    audit_trail?: { ... };
}
```

### 2.2 Selector 规范（来自 ce06/selector.ts）

```typescript
export type Stage3EngineMode = 'REAL' | 'REPLAY' | 'LEGACY_STUB';

export async function ce06Selector(input: CE06Input): Promise<CE06Output | null> {
  const mode = getMode(); // process.env.STAGE3_ENGINE_MODE
  if (mode === 'REAL') return ce06RealEngine(input);
  if (mode === 'REPLAY') return ce06ReplayEngine(input);
  return null;
}
```

---

## 3. EngineAdapter 接口（shared-types）

**路径**: `packages/shared-types/src/engines/engine-adapter.ts`

```typescript
export interface EngineAdapter {
  name: string;
  supports(engineKey: string): boolean;
  invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
```

**调用关系**:

- `apps/api/src/engine-hub/engine-invoker-hub.service.ts` → 调用 EngineAdapter.invoke()
- `apps/workers/src/engine-adapter-client.ts` → Worker 侧适配器注册

---

## 4. 结论

| 问题                      | 答案                                           |
| ------------------------- | ---------------------------------------------- |
| 是否存在显式母版/脚手架？ | ❌ 不存在                                      |
| 是否存在事实母版模式？    | ✅ 存在（5 文件结构）                          |
| 母版覆盖哪些引擎？        | ce03, ce04, ce06, shot_render                  |
| 是否有脚手架生成工具？    | ❌ 不存在                                      |
| 是否有引擎矩阵 SSOT？     | ⚠️ 部分存在 `STAGE3_ENGINE_MATRIX_SNAPSHOT.md` |

---

## 5. MODE: PLAN 建议

### 5.1 如需批量补齐 60+ 引擎

1. **新建显式母版**：`packages/engines/_template/`
   - `_template/types.ts` (带 billing_usage 占位)
   - `_template/selector.ts` (REAL/REPLAY 切换)
   - `_template/real.ts` (真实实现骨架)
   - `_template/replay.ts` (重放骨架)
   - `_template/index.ts` (导出)

2. **新建脚手架脚本**：`tools/scripts/scaffold_engine.sh`

   ```bash
   # 用法: ./scaffold_engine.sh CE07_MEMORY_UPDATE
   # 生成: packages/engines/ce07_memory_update/{5文件}
   ```

3. **统一引擎矩阵 SSOT**：`docs/_specs/ENGINE_MATRIX_SSOT.md`
   - 列出 60+ 引擎：EngineKey、JobType、Mode、BillingModel、Gate

### 5.2 P0 优先引擎（必须真做）

| EngineKey            | 说明     | 理由         |
| -------------------- | -------- | ------------ |
| `shot_render`        | 分镜渲染 | 视频产线末端 |
| `video_merge`        | 视频合成 | 视频产线末端 |
| `ce06_novel_parsing` | 小说解析 | 产线入口     |
