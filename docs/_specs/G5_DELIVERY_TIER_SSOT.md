# G5 交付层级标准 (G5_DELIVERY_TIER_SSOT)

> **级别**：SYSTEM / SSOT
> **版本**：V1.0
> **状态**：SEALED

本文定义 G5 系列视频的高级交付标准。**Gate-0 (1440p)** 基线保持不变，作为历史兼容层。新的交付 Tier 用于 4K/8K 商业级产出。

## 1. 交付分级矩阵 (Delivery Matrix)

| 交付等级 (Tier) | 分辨率 (Width x Height) | 帧率 (fps) | 容器格式          |
| :-------------- | :---------------------- | :--------- | :---------------- |
| **Tier A (4K)** | 3840 x 2160             | 24         | MP4 (libx264)     |
| **Tier S (8K)** | 7680 x 4320             | 24         | MP4/MKV (libx265) |

## 2. 物理校验规范 (Physical Gate)

- **Width/Height**: 必须完全符合矩阵定义，像素点误差为 0。
- **nb_frames**: 必须与计划帧数严格一致。
- **Codec**:
  - 4K: H.264 (High Profile).
  - 8K: HEVC (Main 10 Profile).

## 3. 立法说明

1. **不回退原则**：任何已封板的 E0001 等历史证据保持 1440p 原始状态，新 Tier 仅作用于后续生产。
2. **资产前置**：只要指定了 Tier，必须通过 `asset_pixel_density_gate.js` 校验，低清资产（密度不足）严禁硬拉分辨率。
