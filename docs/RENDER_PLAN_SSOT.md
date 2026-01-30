# RENDER_PLAN_SSOT.md

> **适用范围**：Super Caterpillar / 毛毛虫宇宙 渲染执行链 (Phase E/F)
> **目的**：定义从 `ShotSpec` 到渲染引擎（Unity/Unreal）的中间交换协议。

---

## 1. 数据结构协议 (Data Structure)

渲染计划以 Episode 为单位，输出为 `*.render_plan.json`。

### 1.1 Root 对象

| 字段                    | 类型    | 说明                  |
| :---------------------- | :------ | :-------------------- |
| `episodeId`             | String  | 集数唯一标识          |
| `renderContractVersion` | String  | 渲染契约版本          |
| `renderMapSha256`       | String  | 所用渲染映射的 SHA256 |
| `totalFrames`           | Integer | 全集总帧数 (FPS=24)   |
| `renderShots`           | Array   | 渲染指令队列          |

### 1.2 RenderShot 对象 (核心指令)

| 字段             | 类型    | 说明                          | 必填   |
| :--------------- | :------ | :---------------------------- | :----- | ----- | --- |
| `shotId`         | String  | 镜头 ID (e.g. E0001_B1_S1)    | 是     |
| `characterId`    | String  | 角色标识                      | 是     |
| `locationId`     | String  | 场景/灯光环境标识             | 是     |
| `comboKey`       | String  | 解算键 (`Pose                 | Motion | Cam`) | 是  |
| `templateId`     | String  | 渲染模板 ID (来自 render_map) | 是     |
| `startFrame`     | Integer | 在全集中的起始帧              | 是     |
| `durationFrames` | Integer | 镜头持续总帧数                | 是     |
| `speed`          | Float   | 动画执行速率乘数              | 是     |
| `sfxIds`         | Array   | 触发的音效 ID 列表            | 否     |
| `dialogue`       | String  | 台词文本 (仅用于验证/字幕)    | 否     |

---

## 2. 核心计算规则

### 2.1 帧率约定

- **FPS**: 固定为 24 帧/秒。
- **转换公式**: `Frames = Seconds * 24`。

### 2.2 时长推导

- 每个 RenderShot 的 `durationFrames` 由其关联的 `motionId.durationFrames` 指向。
- 时序对齐: `durationFrames = floor(assetDurationFrames / speed)`。
- **对齐要求**: 台词镜头必须 100% 命中 `templateId`。

---

## 3. 约束断言 (P0-RP)

1. **SSOT 映射**: `comboKey` 必须存在于最新的 `render_map.json`。
2. **时序连续**: `current.startFrame == prev.startFrame + prev.durationFrames`。
3. **时长误差**: `EVI.durationSec` 与 `totalFrames/24` 的误差不得超过 ±0.1s。

---

## 4. 只读基线封印 (Seal Block)

> [!IMPORTANT]
> 以下指纹代表 Phase E 工业级封板的「唯一真态」。任何非显式申报的变更将破坏审计链。

- **renderContractVersion**: `1.0.0`
- **sampleShotSpecPath**: `docs/story_bank/season_01/produced/E0001_full.shot.json`
- **sampleShotSpecSha256**: `88a592a5a9c3ac74f13b3f9ab1e1ea472e815de636585da739c0891a109e529b`
- **render_map_sha256**: `ff8d6b9b31bb9aea813914e11d006e88a471599bf0a767d291bb5dadae340b94`
- **frame_continuity_report_sha256**: `aa4c7b9e4f9cd4bca12357bacd1805b4102833633f114f8e76ff9cb09ccb61b6`
- **preview_real_R1_sha256**: `fcbc034af6c102dcab1aa6fa67fbe923b3dab65709dba31676a00dfd1b260b31`
- **preview_real_R2_sha256**: `fcbc034af6c102dcab1aa6fa67fbe923b3dab65709dba31676a00dfd1b260b31`
