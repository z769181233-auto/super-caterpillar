# Super Caterpillar Engine Seal Matrix (SSOT)

该文件记录全工程所有引擎的封板元数据，作为工业化封板脚本生成的唯一事实来源。

## 1. 已封板引擎 (Sealed)

| 领域   | 引擎 Key                 | JobType                  | 封板阶段 | Gate 脚本                               | 状态           |
| :----- | :----------------------- | :----------------------- | :------- | :-------------------------------------- | :------------- |
| Core   | `shot_render`            | `SHOT_RENDER`            | P0-R0    | `gate-p0-r0_mother_shot_render_real.sh` | ✅ SEALED      |
| Novel  | `ce06_novel_parsing`     | `CE06_NOVEL_PARSING`     | P0-R1    | `gate-p0-r1_ce02_ce06_real.sh`          | ✅ SEALED (V2) |
| Score  | `ce03_visual_density`    | `CE03_VISUAL_DENSITY`    | P0-R2    | `gate-p0-r2_ce02_ce03_real.sh`          | ✅ SEALED (V2) |
| Enrich | `ce04_visual_enrichment` | `CE04_VISUAL_ENRICHMENT` | P0-R3    | `gate-p0-r3_ce02_ce04_real.sh`          | ✅ SEALED (V2) |
| Video  | `video_merge`            | `VIDEO_RENDER`           | P0-R4    | `gate-p0-r4_ce02_video_render_real.sh`  | ✅ SEALED (V2) |

## 2. 待封板引擎 (Backlog - Partial)

| 领域     | 引擎 Key              | JobType           | 计划阶段 | 关联模块             | 状态       |
| :------- | :-------------------- | :---------------- | :------- | :------------------- | :--------- |
| Prompt   | `ce01_prompt_gen`     | `CE01_PROMPT_GEN` | P0-R5    | `@scu/engines-ce01`  | ⏳ PENDING |
| Audio    | `audio_gen`           | `AUDIO_GEN`       | P0-R6    | `@scu/engines-audio` | ⏳ PENDING |
| Security | `ce09_security_check` | `CE09_SECURITY`   | P1-R1    | `@scu/engines-ce09`  | ⏳ PENDING |
| ...      | ...                   | ...               | ...      | ...                  | ...        |

## 3. 封板准入不变量 (Audit V2 Standards)

所有引擎封板必须通过以下检测：

1. **Entry Integrity**: 必须通过 `CE02` Mother Engine (`/api/_internal/engine/invoke`) 调用，严禁直连。
2. **Ledger Isolation**: `isVerification=true` 时，`cost_ledgers` 记录必须为 0。
3. **Idempotency**: 必须支持基于 `dedupeKey` 的 API 层幂等。
4. **Audit Consistency**: `audit_trail` 必须包含 `engine_version` 与 `timestamp`。
5. **Asset Durability**: 对于产出文件的引擎（如 Video/Audio），必须验证物理资产的存在性与哈希一致性。
