# Stage-3 Production Transition: Pre-Exec Bypass Audit

**Audit Timestamp**: 2026-01-12T06:12:29Z
**Baseline Tag**: `stage3_prod_ready_pre_exec_Baseline`

以下是当前系统中存在的 Bypass 逻辑点位，将在 Stage-3 EXECUTE 阶段被物理移除。

## 1. GATE-3-A: CE06 真实层级落库 (Missing)
- **文件**: `apps/api/src/job/job.service.ts`
- **行号**: ~2752
- **原因**: 仅触发了 CE03 任务，未调用 `StructureGenerateService.applyAnalyzedStructureToDatabase`。导致数据库中不存在真实的 Episode/Scene/Shot 树状结构。
- **关联 Mock**: `apps/tools/mock-http-engine/server.ts` 返回的 `scenes` 数量只有 1 个，不满足生产门槛 (scenes>=2)。

## 2. GATE-3-B: Timeline 生产化 (Bypassed)
### TimelineCompose
- **文件**: `apps/workers/src/processors/timeline-compose.processor.ts`
- **行号**: 102-107
- **现象**: 注释掉了 `scene.shots.length < 2` 的校验 guard。

### TimelineRender
- **文件**: `apps/workers/src/processors/timeline-render.processor.ts`
- **行号**: 41-44, 99-104
- **现象**: 注释掉了 `timeline.shots.length < 2` 校验和 `frames.txt` 存在性校验。
- **行号**: 147, 265
- **现象**: 使用 `fs.writeFileSync` 模拟了最终的 MP4/Mixed 产物，未真实调用 FFmpeg。

## 3. GATE-3-C: CE09 安全链路 (Partial Stub)
- **文件**: `apps/workers/src/processors/media-security.processor.ts`
- **行号**: 115-119
- **现象**: `hlsPlaylistUrl` 和 `signedUrl` 使用了硬编码的 `https://cdn.scu.com/...` 前缀，未对接真实的分发策略。
- **现象**: 仅模拟了文件拷贝，未执行真实的水印挂载和 HLS 封装（m3u8+ts）。

---
**本审计记录作为 Stage-3 物理移除 Bypass 的最高对标证据。目标：Stage-3 结束后，以上注释代码全部移除，Mock 内容转为物理产出。**
