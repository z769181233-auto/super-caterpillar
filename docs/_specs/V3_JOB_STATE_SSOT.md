# V3_JOB_STATE_SSOT.md - V3 任务状态与进度单一真源

> **版本**: 1.0.0  
> **状态**: ACTIVE  
> **更新时间**: 2026-01-19

---

## 1. 核心进度枚举 (Current Step Hierarchy)

所有 V3 任务在执行过程中必须通过 `current_step` 字段上报当前执行的子阶段。以下为标准枚举值：

| Step ID            | 描述                   | 涉及引擎/组件    | 备注                          |
| :----------------- | :--------------------- | :--------------- | :---------------------------- |
| `CE06_SCAN`        | 文本目录扫描           | ce06_scan_toc    | 第一阶段：结构化扫描          |
| `CE06_PARSING`     | 文本分块解析           | ce06_chunk_parse | 第二阶段：语义提取            |
| `SCENE_PERSIST`    | 场景物理持久化与索引   | Internal-DB      | 场景库就绪                    |
| `CE11_SHOT_GEN`    | 分镜描述生成           | ce11_real        | 视觉蓝图生成                  |
| `SHOT_PERSIST`     | 分镜物理落库           | Internal-DB      | 分镜库就绪                    |
| `SHOT_RENDER`      | 分镜图片渲染           | shot_render      | 关键帧生成                    |
| `TIMELINE_COMPOSE` | 时间轴编排与指纹注入   | ce10             | 指纹与转场编排                |
| `VIDEO_MERGE`      | 视频剪辑与声道混音     | video_merge      | FFmpeg 合成                   |
| `MEDIA_SECURITY`   | 安全水印与 DRM 封装    | ce09             | 版权保护                      |
| `PUBLISH_HLS`      | CDN 分发与产物发布通知 | Internal-S3      | 状态变为 PUBLISHED 的前置步骤 |

---

## 2. 状态映射 (Status Mapping)

| Prisma Status | V3 Contract Status | 含义                 |
| :------------ | :----------------- | :------------------- |
| `PENDING`     | `QUEUED`           | 任务已创建，等待调度 |
| `RUNNING`     | `RUNNING`          | 核心逻辑执行中       |
| `SUCCEEDED`   | `SUCCEEDED`        | 任务成功，结果可用   |
| `FAILED`      | `FAILED`           | 任务不可恢复失败     |

---

## 3. 回执结构规范 (Receipt Specification)

`result_preview` 字段在 `SUCCEEDED` 状态下必须包含以下要素：

```json
{
  "scenes_count": 12,
  "shots_count": 48,
  "asset_id": "uuid",
  "hls_url": "https://cdn.../playlist.m3u8",
  "mp4_url": "https://cdn.../output.mp4",
  "checksum": "sha256:...",
  "cost_ledger_count": 5
}
```

---

## 4. 错误分级 (Error Taxonomy)

| Error Code                | 描述                 | 处理建议     |
| :------------------------ | :------------------- | :----------- |
| `ERR_PROMPT_INVALID`      | 提示词违规或无法解析 | 用户修改输入 |
| `ERR_GPU_TIMEOUT`         | GPU 推理超时         | 自动重试     |
| `ERR_CREDIT_INSUFFICIENT` | 余额不足             | 用户充值     |
| `ERR_SCHEMA_MISMATCH`     | 数据契约不匹配       | 研发介入     |
