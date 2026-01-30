# G5 生产认证协议 V1 (Production Protocol)

> **版本**：V1.0  
> **认证状态**：APPROVED (Based on E0001-Real)  
> **核心目标**：确保所有产出物 100% 符合 Gate-0 法律。

## 1. 资产准入标准 (Asset Admission)

所有角色资产必须在生产前通过以下审计：

| 检查项     | 规格要求                                       | 验证工具           |
| :--------- | :--------------------------------------------- | :----------------- |
| **三视图** | front.png, side.png, back.png 缺一不可         | `ls -l`            |
| **分辨率** | 垂直像素 >= 1440px                             | `identify`         |
| **透明度** | PNG-24 with Alpha (透明背景)                   | `file`             |
| **风格度** | 服装细节与光影在三图中必须维持强一致性         | 人工审计           |
| **元数据** | 必须提供 `mapping.json` 定义地面 Pivot (0.95+) | `cat mapping.json` |

## 2. 镜头渲染逻辑 (Rendering Logic)

渲染器（推荐使用 Unreal Executor V4.2+）必须强制执行以下路由：

- **相機角度 (Angle) 映射表**：
  - `[0, 45°) ∪ [315, 360°)` -> **FRONT**
  - `[45, 135°) ∪ [225, 315°)` -> **SIDE**
  - `[135, 225°)` -> **BACK**

- **地面锚定 (Grounding)**：
  - 必须根据 `isStanding` 状态应用 0-Drift 规则。
  - 必须为每个图层生成至少一层逻辑阴影 (Soft Shadow Overlay)。

## 3. 视频交付定义 (Delivery Definition)

最终封装 `.mp4` 必须通过以下硬门禁：

```bash
# 符合法律定义的验证命令
ffprobe -v error -select_streams v:0 \
  -show_entries stream=nb_frames,avg_frame_rate,width,height \
  -of default=noprint_wrappers=1:nokey=1 output.mp4
```

- **预期输出**：
  - 帧率：`24/1`
  - 分辨率：`2560` (W) x `1440` (H)
  - 帧数：必须为整数，且等于 `duration_sec * 24`

## 4. 异常处理 (Redlines)

- ❌ **Forbidden**: 任何“视角未刷新”的连续 Orbit 镜头一律判定为 FAIL。
- ❌ **Forbidden**: 任何由于资产缺失导致的“单图平移”一律判定为故障。
- ❌ **Forbidden**: 任何 FPS 不稳定（Variable Frame Rate）的产出物禁止作为最终交付。
