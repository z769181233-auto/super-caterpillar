# G5_ASSET_LAYER_PROTOCOL: 角色资产分层合成协议

> **状态**：DRAFT (G5-P0)
> **适用版本**：G5+ Content Leap

## 1. 核心目标

建立标准化的图层叠加逻辑，支持“语义级”角色合成与环境融合，消除“贴纸感（Sticker Look）”。

## 2. 图层堆叠顺序 (Order of Appearance)

从下到上（值越大越靠前）：

| Order | Layer ID | Description                     | Component Path                               |
| :---- | :------- | :------------------------------ | :------------------------------------------- |
| 0     | `SHADOW` | 逻辑阴影 (Soft Ellipse Overlay) | Generated                                    |
| 10    | `BASE`   | 角色主体 (Torso)                | `/v1/full.png` or `/v1/components/torso.png` |
| 20    | `FACE`   | 表情/头部 (Face/Neck)           | `/v1/components/head.png`                    |
| 30    | `ITEM`   | 手持道具/配饰                   | `/v1/components/item_*.png`                  |

## 3. 合成算法 (Composition Algorithm)

1. **[BASE ALIGNMENT]**: 以 `full.png` 或 `torso.png` 为基准定位。
2. **[HEAD ANCHORING]**: 根据资产 `mapping.json` 定义的锚点，将头部叠加至颈部位置。
3. **[SHADOW GENERATION]**:
   - 类型: `ellipse_soft` (羽化椭圆)。
   - 位置: 角色最低边界下方 20-50px。
   - 颜色: `#000000` (Opacity: 30%-50%)。
4. **[BLENDING]**: 使用 Alpha Blending (Normal Mode)，边缘羽化 1-2px。

## 4. 验收标准

- **Anti-Floating**: 角色脚下必须存在阴影。
- **Alignment Integrity**: 头部与身体连接处无白线或断层。
