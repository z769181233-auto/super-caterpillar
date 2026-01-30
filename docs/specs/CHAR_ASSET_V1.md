# CHAR_ASSET_V1: 工业级角色资产规范

> **状态**：RELEASED (G5-A)
> **适用版本**：G5+ Content Leap

## 1. 物理规格 (Physical Specs)

- **格式**：PNG-24 with Alpha Channel.
- **背景**：必须为 **透明 (Transparent)**，严禁白底或带背景。
- **分辨率**：高度不得低于 1080px (推荐 1440px+)。

## 2. 内容层级 (Layering Requirement)

为了支持“语义表演”，V1 资产建议提供分层素材：

1. **[BASE] Torso**: 躯干部分，作为核心基准位。
2. **[HEAD] Face/Neck**: 头部，需支持微小的转动与点头动作。
3. **[ARMS] Left/Right Arms**: 手臂，需支持摆动与持物。

_注：当前阶段若无法提供全量分层，必须确保全身剪裁干净，画风统一。_

## 3. 审美一致性 (Visual Style)

- **风格限定**：古典插画 / 高精国漫风。
- **细节要求**：衣褶清晰、面部特征明确、材质光影符合逻辑。
- **禁止行为**：
  - 禁止使用 1x1 或 像素人。
  - 禁止使用 简笔画 或 非闭合线条。

## 4. 目录结构

```bash
assets/characters/v1/
├── CH_XueZhiYing/
│   ├── full.png
│   ├── mapping.json (表情/关键帧映射)
│   └── components/ (可选分层)
└── CH_XiaoYunQi/
    └── full.png
```

## 5. 验收标准 (Quality Gate)

- **Character Belonging**: 角色脚下必须生成逻辑阴影。
- **Anti-Sticker**: 边缘无杂色锯齿。
