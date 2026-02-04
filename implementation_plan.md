# 实施方案：真实内容 Provider 全接入 (T1 闭环)

本方案旨在彻底消除视频生产管线中的占位符内容，通过接入 ComfyUI 真实画面与 2.5D 运动补偿，实现从小说文本到真实视频画面的闭环。

## 用户审核事项（User Review Required）

> [!IMPORTANT]
> **本地 ComfyUI 服务依赖**：确保 ComfyUI 已在 `http://127.0.0.1:8188` 运行。
>
> **动态 ProjectId 策略**：每次运行 Pilot 将生成唯一的 ProjectId，避免旧产物干扰。

## 拟定变更

### 阶段 P0：硬前提与污染治理

#### [MODIFY] [run_production_pilot.ts](file:///tools/production/run_production_pilot.ts)
- 将 `PROJECT_ID` 修改为基于 `TRACE_ID` 的动态名称（格式：`prod-pilot-${RUN_ID}`）。

#### [MODIFY] 处理器调试清理
- 检查 `apps/workers/src/processors/` 目录下所有处理器，清理形如 `debug_ce06.txt` 的根目录写入行为，统一重定向至 `.data/`。

#### [MODIFY] [timeline-render.processor.ts](file:///apps/workers/src/processors/timeline-render.processor.ts)
- 锁死渲染逻辑：必须存在 `AssetType.VIDEO` 资产才允许进行 Concat。
- 移除所有 `testsrc`, `noise`, `dummy` 等兜底生成逻辑，遇到此类路径直接报错。

---

### 阶段 P1：接入 ComfyUI (图片生成)

#### [NEW] [comfyui_client.ts](file:///tools/prod/comfyui_client.ts)
- 实现通用 ComfyUI 客户端，支持 `prompt` 提交、`history` 轮询及产物下载。

#### [MODIFY] [run_character_turnaround.ts](file:///tools/prod/run_character_turnaround.ts)
- 接入 ComfyUI 生成角色 `front`, `side`, `back` 三视图图片。
- 生成后图片存储于 `.data/storage/characters/` 并落库 `Asset` 表。

#### [MODIFY] [ce04-visual-enrichment.processor.ts](file:///apps/workers/src/processors/ce04-visual-enrichment.processor.ts)
- 提交 `shot.prompt` 至 ComfyUI 生成 `keyframe.png`。
- 落库 `Asset(ownerType=SHOT, type=IMAGE)`。
- 生成绝对路径索引的 `frames.txt`。

---

### 阶段 P2：ShotRender 2.5D 化 (真画面+运动)

#### [MODIFY] [shot-render.local.adapter.ts](file:///apps/api/src/engines/adapters/shot-render.local.adapter.ts)
- 使用 `keyframe.png` 作为输入，通过 FFmpeg `zoompan` 滤镜实现 2.5D 动态效果。
- 输出固定命名为 `source.mp4` 并落库 `Asset(ownerType=SHOT, type=VIDEO)`。
- 增加基础质量断言：时长 >= 4s, 大小 >= 1MB, 黑帧比例 < 10%。

---

### 阶段 P3：高质量 Timeline 合成

#### [MODIFY] 高质量参数配置
- 强制输出 1080p 分辨率。
- 采用生产级编码参数：`-crf 18 -preset slow -b:v 4M`。

---

### 阶段 P4：门禁 (非占位符 Gate)

#### [NEW] [gate_non_placeholder_video.sh](file:///tools/gate/gates/gate_non_placeholder_video.sh)
- 实现黑帧检测、时长/码率检测。
- 检测命令行或日志中是否包含 `testsrc`, `smptebars`, `color`, `noise` 等占位符特征。

---

### 阶段 P5：崩坏治理与自愈 (Self-Healing)

#### [MODIFY] [start_audit_services.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/start_audit_services.sh)
- 优化进程管理：启动前先通过端口检查精准杀掉存量进程（而非盲目 pkill node）。
- 增加服务健康度强制等待：API 未就绪前，禁止启动 Worker 和 Pilot。

#### [FIX] Prisma DMMF 缺失修复
- 执行 `pnpm -C packages/database build` 及 `npx prisma generate`。
- 确保 Worker 启动时能够正确解析 `database` 包。

#### [FIX] ComfyUI CLIP 加载修复
- 强制使用 `sd_xl_base_1.0.safetensors` 作为标准底模，并验证其完整性。
- 更新模版中的 `CheckpointLoaderSimple` 逻辑，确保 CLIP 连接正确。
- 如果底模本身不带 CLIP，则切换为加载独立的 CLIP 模型（或切换为确认带 CLIP 的 v1.5 模型并重置 model.safetensors 指向）。

---

### 自动化测试
1. 执行 Pilot 全链路：`npx ts-node tools/production/run_production_pilot.ts <novel_file>`。
2. 执行门禁脚本：`bash tools/gate/gates/gate_non_placeholder_video.sh`。

### 验收证据（证据包）
- `final.mp4` 必须包含真实画面内容。
- `character_bible.json` 关联的三视图图片真实可见。
- Gate 脚本通过。

---

### 阶段 P6-0: 15M Import OOM 治理

#### [FIX] [start_audit_services.sh](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/start_audit_services.sh)
- 增加 `NODE_OPTIONS="--max-old-space-size=4096"`，为 API 和 Worker 进程分配 4GB 内存，防止 15M 文本处理时 OOM。

### 阶段 P6-0: Operational Grade 15M Import

#### [NEW] [Ref Protocol] (P6-0-1)
- **Goal**: 禁止 15M JSON Stringify，改用 Storage Key 引用。
- **Action**:
    - Worker: 上传文本到 `.data/storage/novels/<sha256>.txt` (Stream Write)。
    - Payload: `{ "novelRef": { "storageKey": "...", "sha256": "...", "size": ... } }`。
    - API: `EngineHubController` 识别 `novelRef`，不再尝试 JSON Parse 巨量内容。

#### [NEW] [Security Loop] (P6-0-2)
- **Goal**: 闭环校验 X-Content-SHA256。
- **Action**:
    - Worker: 计算 SHA256，放入 `X-Content-SHA256` 头。
    - API Security:
        1. 验证 HMAC (Canonical String 包含 SHA256)。
        2. **[NEW]** 流式读取 Storage 文件计算 SHA256，与 Header 比对。不一致则 `401 Unauthorized`。

#### [FIX] [Business Logic] (P6-0-3)
- **Goal**: 修复 Chapter not found。
- **Action**:
    - `ce06-novel-parsing.processor.ts`:
        - 增加 `novelRef` 支持，从 Storage 读取 `rawText`。
        - 传入 `novelRef` 给 `engineHub` (Internal API)。
        - 修复 Race Condition: 将 Job Dispatch 移至 Transaction 提交之后。
    - `CE06LocalAdapter` (API):
        - 注入 `LocalStorageService`。
        - 自动将 `novelRef` 解析为 `structured_text`。

#### [NEW] [Gate & Evidence] (P6-0-4)
- **Gate**: `gate_massive_import_15m_v1.sh` 需产出 `run.log`, `perf.json`, `proc_snapshot.txt`, `db_snapshot.sql`. (Verified)
- **Index**: 生成 `EVIDENCE_INDEX.json` 及 checksums.
- **Result**: ✅ PASS (Throughput ~10M chars/min, No OOM).
- **Result**: ✅ PASS (Throughput ~10M chars/min, No OOM).

### 阶段 P6-0: SEALED / CLOSED
> [!NOTE]
> **Status**: [SEALED]
> **Final Protocol**: Storage Ref + Stream + HMAC+SHA Loop.
> **Evidence**: `docs/_evidence/p6_0_massive_import_seal_20260204_233835`
