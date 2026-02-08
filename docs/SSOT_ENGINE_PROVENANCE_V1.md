# Week 2 Engine Provenance SSOT (V1)

> **版本**: 1.0.0
> **口径**: REAL_ENGINE_ACCEPTANCE
> **目标**: 固化真实引擎产物的溯源契约，确保证据链不可抵赖。

## 1. 产物审计套件 (Artifact Suite)

所有产物必须位于证据目录的 `artifacts/` 下，命名必须遵循：

| 文件名 | 说明 | 必选 |
| :--- | :--- | :--- |
| `shot_render_output.mp4` | 真实引擎生成的 MP4 视频 | 是 |
| `shot_render_output.mp4.sha256` | 视频内容的 SHA256 校验和 | 是 |
| `shot_render_output.provenance.json` | 溯源元数据 | 是 |
| `shot_render_output.provenance.json.sha256` | Provenance 文件的 SHA256 校验和 | 是 |

## 2. Provenance JSON Schema

```json
{
  "seal_type": "REAL_ENGINE_ACCEPTANCE",
  "artifact": {
    "relpath": "artifacts/shot_render_output.mp4",
    "sha256": "37042d15ce696bd758d4f0ef999562f41a859f5f32f2e7f5adc24efa0e0dbb00",
    "bytes": 523888,
    "duration_s": 2.0
  },
  "producer": {
    "kind": "SHOT_RENDER",
    "mode": "REAL_ENGINE",
    "engine_provider": "replicate",
    "engine_model": "stability-ai/sdxl:...",
    "engine_run_id": "req_12345",
    "adapter": "ShotRenderReplicateAdapter",
    "adapter_version": "git-sha-hash"
  },
  "job": {
    "job_id": "job_abc",
    "finished_at": "2026-02-06T20:20:00Z"
  },
  "db": {
    "job_table": "shot_jobs",
    "job_id_col": "id",
    "status_col": "status",
    "output_sha_col": "outputSha256",
    "engine_run_id_col": "engineRunId",
    "engine_provider_col": "engineProvider",
    "engine_model_col": "engineModel"
  }
}
```

## 3. 核验规范 (Verification)

### 3.1 一致性断言
- `(现场 mp4 sha) == (provenance.artifact.sha256)`
- `(现场 mp4 sha) == (mp4.sha256 文件内容)`
- `(provenance.json sha) == (provenance.json.sha256 内容)`

### 3.2 溯源性断言
- `producer.mode` 必须为 `REAL_ENGINE`。
- `engine_run_id` 必须为第三方引擎提供商（Provider）的真实运行 ID。

### 3.3 数据库绑定
- `job.job_id` 在 `db.job_table` 中必须存在且状态为 `SUCCEEDED`。
- 数据库字段值必须与 Provenance 及现场产物 SHA256 完全对齐。

## 4. 禁止事项
- ❌ **禁止 Surrogate**: 任何 `producer.mode != REAL_ENGINE` 的产物均无法通过 Week 2 封板。
- ❌ **禁止占位符**: `engine_run_id` 为空或为 mock ID 的产物将被拒收。
