# Film IR v1 SSOT

本文件定义 Super Caterpillar 当前 Director Layer 的最小执行 SSOT。

目标不是替代现有 `scene / shot / timeline / publish / gate` 主链，而是在其上方补一层
可持久化、可推理、可门禁、可证据化的导演中间语言（Film IR）。

## 1. 作用范围

Film IR v1 用于：

- 把 `scene` 级文本与上下文翻译成导演意图
- 作为 `Shot Planner` 的正式输入
- 作为 `Consistency State Engine` 的约束来源
- 作为 `Judge / Content Gates` 的语义参考
- 进入 evidence 与 audit 链

Film IR v1 不直接负责：

- 生成视频资产
- 替代现有 `CE11 / SHOT_RENDER / TIMELINE_COMPOSE / PUBLISH`
- 直接重写现有 `scene / shot` 主表语义

## 2. 版本原则

- `planner_version` 必须持久化。
- rerun / replan 生成新版本，不覆盖历史版本。
- 当前运行链只消费：
  - `APPROVED`
  - `LOCKED`
- `DRAFT` 只用于预览、校验、人工修订。

## 3. 最小字段集

### 3.1 强持久化字段

以下字段必须进入主表 `film_ir`：

- `scene_id`
- `project_id`
- `planner_version`
- `status`
- `source_text`
- `source_context_summary`
- `dramatic_function`
- `dramatic_goal`
- `emotional_target`
- `tension_curve`
- `pov_character`
- `audience_information_mode`
- `relationship_before`
- `relationship_after`
- `visual_strategy`
- `blocking_strategy`
- `shot_pattern`
- `avg_shot_length_sec`
- `camera_distance_strategy`
- `camera_angle_strategy`
- `camera_motion_style`
- `composition_style`
- `spatial_strategy`
- `lighting_style`
- `color_strategy`
- `sound_strategy`
- `silence_strategy`
- `editing_rhythm_strategy`
- `continuity_constraints`
- `character_state_constraints`
- `costume_state_constraints`
- `prop_state_constraints`
- `location_state_constraints`
- `why_this_choice`
- `alternative_rejected_reason`
- `quality_score`
- `confidence`
- `evidence_ref`

### 3.2 中间推理缓存字段

以下内容不应塞进 `film_ir` 主表，建议进入 append-only 运行记录：

- provider 原始响应
- prompt / prompt hash
- retry trace
- 结构化校验错误与 warning
- normalized draft 前后的中间转换结果

建议落点：

- `film_ir_runs`
- 或 `evidence_records`

### 3.3 必须进入 evidence 的字段

- `scene_id`
- `planner_version`
- `source_context_summary`
- `dramatic_function`
- `dramatic_goal`
- `visual_strategy`
- `shot_pattern`
- `continuity_constraints`
- `why_this_choice`
- `alternative_rejected_reason`
- `quality_score`
- `evidence_ref`

### 3.4 必须暴露给 Shot Planner 的字段

- `dramatic_function`
- `dramatic_goal`
- `emotional_target`
- `tension_curve`
- `visual_strategy`
- `blocking_strategy`
- `shot_pattern`
- `avg_shot_length_sec`
- `camera_distance_strategy`
- `camera_angle_strategy`
- `camera_motion_style`
- `composition_style`
- `spatial_strategy`
- `lighting_style`
- `color_strategy`
- `editing_rhythm_strategy`
- 全部 continuity / state constraints

### 3.5 必须进入 Gate 判定的字段

- `dramatic_goal`
- `emotional_target`
- `tension_curve`
- `visual_strategy`
- `shot_pattern`
- `continuity_constraints`
- `character_state_constraints`
- `costume_state_constraints`
- `prop_state_constraints`
- `location_state_constraints`
- `quality_score`

## 4. 字段语义

### Dramatic Layer

- `dramatic_function`
  - 场景在叙事中的功能，不是简单情绪标签。
- `dramatic_goal`
  - 本场戏必须达成的戏剧目标。
- `emotional_target`
  - 观众应当感受到的情绪结果。
- `tension_curve`
  - 张力走势，不是生成参数。

### Visual / Blocking Layer

- `visual_strategy`
  - 场景整体视觉语法摘要。
- `blocking_strategy`
  - 人物、道具、空间的调度策略。
- `shot_pattern`
  - 镜头分布与切换模式。
- `avg_shot_length_sec`
  - 给 shot planner 的节奏约束，不是硬时长。

### Continuity Layer

- `continuity_constraints`
  - 总连续性规则入口。
- `character_state_constraints`
  - 角色外观、伤势、情绪、姿态等。
- `costume_state_constraints`
  - 服装状态。
- `prop_state_constraints`
  - 道具状态与归属。
- `location_state_constraints`
  - 位置、空间、布景状态。

### Evidence Layer

- `why_this_choice`
  - 为什么采用该导演方案。
- `alternative_rejected_reason`
  - 为什么拒绝可选方案。
- `quality_score`
  - planner 层自评或前置质控分。
- `evidence_ref`
  - 指向 evidence/audit 系统的正式引用。

## 5. 与现有模型关联

- `film_ir.scene_id -> scenes.id`
- `film_ir.project_id -> projects.id`
- `scenes.film_ir_id -> film_ir.id`
- `shots.film_ir_id -> film_ir.id`

现阶段不新增平行 `scene` 体系，不重写现有：

- `scenes`
- `shots`
- `timeline`
- `assets`
- `published_videos`
- `shot_jobs`

## 6. 状态机

- `DRAFT`
  - Planner 默认写入状态
  - 可修改
  - 不应作为正式下游输入
- `APPROVED`
  - 可作为 `Shot Planner / Judge` 输入
  - 允许受控修改
- `LOCKED`
  - 证据链冻结
  - 不允许覆盖，只允许基于 replan 生成新版本

## 7. 幂等与 rerun

- 同一 `scene_id + planner_version` 必须唯一。
- rerun 不覆盖旧记录，生成新 `planner_version`。
- Scene 当前消费哪个 Film IR，由 `scenes.film_ir_id` 指向。

## 8. 非目标

- 不把 Film IR 当作最终镜头资产。
- 不把 Film IR 变成任意自由文本 note。
- 不直接承载模型原始 reasoning。
- 不绕开现有 gate / evidence / publish 主链。
