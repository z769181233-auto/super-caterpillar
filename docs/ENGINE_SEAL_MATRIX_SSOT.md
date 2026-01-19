# Super Caterpillar Engine Seal Matrix (SSOT)

该文件记录全工程所有引擎的封板元数据，作为工业化封板脚本生成的唯一事实来源。

## 1. 封板分级定义 (Seal Levels)

> **CRITICAL**: 从 P0-R5 起，只有 **L2 (Real)** 真实生产引擎才允许进入本矩阵。
> 任何 L0/L1 (Stub/Contract) 均 **禁止** 录入。

| 等级   | 名称            | 核心要求                                                                       |
| :----- | :-------------- | :----------------------------------------------------------------------------- |
| **L2** | 真实封板 (Real) | **唯一允许等级**。具备真实链路、产物硬断言、幂等性强断言、账本隔离及审计闭环。 |

## 2. 真实生产引擎矩阵 (Real Production Engines)

| 领域   | 引擎 Key                 | Gate 脚本                               | 状态      | 说明                 |
| :----- | :----------------------- | :-------------------------------------- | :-------- | :------------------- |
| Novel  | `ce06_novel_parsing`     | `gate-p0-r1_ce02_ce06_real.sh`          | ✅ SEALED | 真实解析             |
| Score  | `ce03_visual_density`    | `gate-p0-r2_ce02_ce03_real.sh`          | ✅ SEALED | 真实评分             |
| Enrich | `ce04_visual_enrichment` | `gate-p0-r3_ce02_ce04_real.sh`          | ✅ SEALED | 真实扩写             |
| Visual | `shot_render`            | `gate-p0-r0_mother_shot_render_real.sh` | ✅ SEALED | 真实生图 (SD/Local)  |
| Video  | `video_merge`            | `gate-p0-r4_ce02_video_render_real.sh`  | ✅ SEALED | 真实合成 (FFmpeg)    |
| Secure | `ce09_media_security`    | `gate-prod_slice_v1_real.sh`            | 🔄 PLAN   | 真实水印 (Watermark) |
| Pipe   | `pipeline_prod_video_v1` | `gate-prod_slice_v1_real.sh`            | 🔄 PLAN   | 生产 V1 主管线       |

## 3. 封板准入不变量 (Audit V2 Standards)

1. **Entry Integrity**: 必须通过 `CE02` Mother Engine (`/api/_internal/engine/invoke`) 调用。
2. **Ledger Isolation**: `isVerification=true` 时，`cost_ledgers` 记录必须为 0。
3. **Idempotency (L2)**: 必须断言两次调用的产物 URI 或哈希一致。
4. **Asset Hard-Check (L2)**: 视频类必须通过 `ffprobe` 校验。
5. **Audit Chain**: 必须包含标准 REQ/RUN/SQL_AUDIT 证据。
