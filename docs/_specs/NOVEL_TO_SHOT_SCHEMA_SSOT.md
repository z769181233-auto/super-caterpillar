# 小说至分镜语义规约 (NOVEL_TO_SHOT_SCHEMA_SSOT)

> **级别**: SYSTEM / SSOT
> **版本**: V1.0
> **状态**: DRAFT

本项目定义如何将小说文本（Novel Text）解析为可驱动渲染引擎的镜头序列（Shot Sequence）。

## 1. 核心 Schema

每个分镜（Shot）必须包含以下字段：

| 字段           | 类型   | 说明                     | 取值示例                             |
| :------------- | :----- | :----------------------- | :----------------------------------- |
| `shot_id`      | String | 唯一标识符               | `S001_SH01`                          |
| `shot_type`    | Enum   | 镜头类型                 | `close_up`, `medium`, `wide`, `full` |
| `camera`       | Object | 相机参数                 | `{type, movement, lens}`             |
| `characters`   | Array  | 场景内角色               | `["薛知盈", "春桃"]`                 |
| `action`       | String | 动作描述（基于原文）     | `薛知盈转头望向窗外`                 |
| `emotion`      | String | 情绪/气质锁定            | `思念`, `忧郁`, `坚定`               |
| `duration_sec` | Number | 单镜头时长（秒）         | `3.0`                                |
| `novel_quote`  | String | 小说对应原句（物理锚点） | `薛知盈坐在客栈雅间的窗前...`        |

## 2. 相机枚举 (Camera Enums)

- **Movement**: `static`, `pan`, `tilt`, `dolly`, `orbit`
- **Lens**: `35mm` (Standard), `50mm` (Portrait/Close-up), `85mm` (Deep Close-up)

## 3. 语义回溯原则

任何生成的 Shot 必须包含 `novel_quote`。若无法在原文中找到对应锚点，该 Shot 视为无效（幻觉产物）。
