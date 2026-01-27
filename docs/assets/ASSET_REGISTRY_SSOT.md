# ASSET_REGISTRY_SSOT.md

> 目的：建立剧本创作的资产强约束，杜绝占位符，统一 ID 引用。

## 0. 设计理念
- **禁止自由文本**：关键字段必须引用 Registry ID。
- **强类型校验**：P0 门禁必须校验 ID 是否在库中存在。
- **唯一性**：资产 ID 全局唯一（前缀区分）。

---

## 1. 资产分类与前缀
- **Character (CH_)**: 角色库
- **Prop (PR_)**: 道具库
- **Location (LO_)**: 场景库
- **SFX (SF_)**: 音效目录

| 前缀 | 分类名称 | 对应文件 | 备注 |
| :--- | :------- | :------- | :--- |
| `CH_` | Character | `characters.json` | 角色库 |
| `PR_` | Prop | `props.json` | 道具库 |
| `LO_` | Location | `locations.json` | 场景库 |
| `SF_` | SFX Catalog | `sfx_catalog.json` | 音效目录 |
| `PO_` | Poses | `poses.json` | 起势姿态 |
| `MO_` | Motions | `motions.json` | 动作过程 |
| `CM_` | Camera Moves | `camera_moves.json` | 镜头调度 |

---

## 2. 字段映射规范

### ShotSpec 级变更
- `thirdActorProp` -> `thirdActorPropId` (PR_开头的 ID)
- `sfxLines` -> `sfxIds` (SF_开头的 ID 数组)
- `locationId` (LO_开头的 ID)
- `characterId` (CH_开头的 ID)
- `poseId` (PO_开头的 ID)
- `motionId` (MO_开头的 ID)
- `cameraMoveId` (CM_开头的 ID)

---

## 3. 维护流程
1. 新增资产需先提交 JSON 更新。
2. 编译器/Writer Agent 读取 JSON 进行填充。
3. P0 门禁基于 JSON 进行合法性断言。
