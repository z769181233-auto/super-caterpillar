# Super Caterpillar Engine Seal Matrix (SSOT)

该文件记录全工程所有引擎的封板元数据，作为工业化封板脚本生成的唯一事实来源。

## 1. 封板分级定义 (Seal Levels)

| 等级   | 名称                 | 核心要求                                                                   |
| :----- | :------------------- | :------------------------------------------------------------------------- |
| **L0** | 规格封板 (Spec)      | 冻结 API 契约、审计规格、门禁骨架。引擎无需实现真实逻辑。                  |
| **L1** | 集成封板 (Integrate) | 接入真实 Provider，全链路跑通。但产物硬断言或幂等性可能暂未闭环。          |
| **L2** | 真实封板 (Real)      | **最高等级**。具备真实链路、产物硬断言、幂等性强断言、账本隔离及审计闭环。 |

## 2. 已封板引擎 (Sealed)

| 领域   | 引擎 Key                 | JobType                  | 封板阶段 | 封板等级 | Gate 脚本                               | 状态      |
| :----- | :----------------------- | :----------------------- | :------- | :------- | :-------------------------------------- | :-------- |
| Core   | `shot_render`            | `SHOT_RENDER`            | P0-R0    | **L2**   | `gate-p0-r0_mother_shot_render_real.sh` | ✅ SEALED |
| Novel  | `ce06_novel_parsing`     | `CE06_NOVEL_PARSING`     | P0-R1    | **L2**   | `gate-p0-r1_ce02_ce06_real.sh`          | ✅ SEALED |
| Score  | `ce03_visual_density`    | `CE03_VISUAL_DENSITY`    | P0-R2    | **L2**   | `gate-p0-r2_ce02_ce03_real.sh`          | ✅ SEALED |
| Enrich | `ce04_visual_enrichment` | `CE04_VISUAL_ENRICHMENT` | P0-R3    | **L2**   | `gate-p0-r3_ce02_ce04_real.sh`          | ✅ SEALED |
| Video  | `video_merge`            | `VIDEO_RENDER`           | P0-R4    | **L2**   | `gate-p0-r4_ce02_video_render_real.sh`  | ✅ SEALED |

## 3. 待封板引擎 (Backlog)

| 领域     | 引擎 Key              | JobType           | 计划等级 | 计划阶段 | 关联模块             | 状态       |
| :------- | :-------------------- | :---------------- | :------- | :------- | :------------------- | :--------- |
| Prompt   | `ce01_prompt_gen`     | `CE01_PROMPT_GEN` | **L0**   | P0-R5    | `@scu/engines-ce01`  | ⏳ PENDING |
| Audio    | `audio_gen`           | `AUDIO_GEN`       | **L1**   | P0-R6    | `@scu/engines-audio` | ⏳ PENDING |
| Security | `ce09_security_check` | `CE09_SECURITY`   | **L0**   | P1-R1    | `@scu/engines-ce09`  | ⏳ PENDING |

## 4. 封板准入不变量 (Audit V2 Standards)

1. **Entry Integrity**: 必须通过 `CE02` Mother Engine (`/api/_internal/engine/invoke`) 调用。
2. **Ledger Isolation**: `isVerification=true` 时，`cost_ledgers` 记录必须为 0。
3. **Idempotency (L2)**: 必须断言两次调用的产物 URI 或哈希一致。
4. **Asset Hard-Check (L2)**: 视频类必须通过 `ffprobe` 校验。
5. **Audit Chain**: 必须包含标准 REQ/RUN/SQL_AUDIT 证据。
