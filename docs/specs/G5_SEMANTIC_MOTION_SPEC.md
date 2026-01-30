# G5_SEMANTIC_MOTION_SPEC: 语义动作映射引擎规范

> **状态**：DRAFT (G5-P0)
> **适用版本**：G5+ Content Leap

## 1. 核心目标

通过语义标签驱动角色动作，消除“工程性随机抖动”，实现符合导演意图的微表情与肢体微动。

## 2. 强制性红线 (Mandatory Redlines)

1. **[ZERO DRIFT RULE]**: 对于“站立（Standing）”或“静止（Idle）”镜头，垂直方向位移（Vertical Drift / dy）必须严格等于 0。
2. **[SEMANTIC MAPPING]**: 动作必须与 `shot.action` 或 `beat.goal` 语义关联，禁止全片使用单一模板。
3. **[TEMPLATE UNIQUENESS]**: 同一 Shot 内，角色与摄像机的动作模板组合必须在 `motion_plan.json` 中明确记录。

## 3. 标准模板库 (Baseline Templates)

| Template ID      | Description | Parameters                      |
| :--------------- | :---------- | :------------------------------ |
| `idle_breathing` | 基础呼吸感  | amplitude: 0.02, frequency: 0.3 |
| `nod_agree`      | 点头确认    | head_dy: 5px, cycles: 1         |
| `gesture_talk`   | 交谈手势    | arm_amplitude: 0.05             |
| `walk_cycle`     | 步行同步    | full_body_y: sin(t)             |

## 4. 映射逻辑 (Prioritized Mapping)

1. **Explicit**: 匹配 `shot.tags` 或 `shot.action` 中的关键词。
2. **Implicit**: 根据 `shot.type` (如 CLOSE_UP 优先呼吸，LONG_SHOT 优先位移)。
3. **Fallback**: 统一使用 `idle_breathing`。

## 5. 验收标准

- **Gate-Motion-Drift**: 对于站立镜头，检测关键帧像素偏移，dy > 0px 则立即拒绝渲染。
