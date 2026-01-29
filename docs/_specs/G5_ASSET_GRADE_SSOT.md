# G5 Asset Grade SSOT (G5_ASSET_GRADE_SSOT)

> level: SYSTEM / SSOT
> version: v1.0
> status: DRAFT (to be SEALED)

本法用于定义：哪些角色/背景资产允许进入 Tier A(4K) / Tier S(8K) 交付。

## 1. 资产等级

- Grade C (Legacy): 插画位图/软边描线/低频信息 —— 仅允许 1440p
- Grade B (4K-Ready): 有明确线稿层 + 面部无脏块 + 结构纹理 —— 允许 4K
- Grade A (8K-Ready): 线稿结构密度达标 + 面部皮肤纯净 + 发丝结构线存在 —— 允许 8K

## 2. 硬门禁（必须同时满足）

### 2.1 线稿密度门禁 (Lineart Density Gate)

- 在人物脸部 ROI 内，边缘像素占比 >= 6%
- 低于阈值：判定为低频插画，禁止 4K/8K

### 2.2 面部洁净门禁 (Face Clean Gate)

- skin_cleanliness_checker spotCount == 0
- 任一 view 不满足：禁止 4K/8K

### 2.3 资产原生分辨率门禁 (Native Resolution Gate)

- 人物 PNG 最短边 >= 4096 才允许 4K
- 人物 PNG 最短边 >= 8192 才允许 8K
- 不满足：禁止 4K/8K

## 3. 强制降级规则

当指定 --tier=4k/8k，但资产等级不达标：

- 自动降级为 1440p
- 在 evidence 中写明 downgrade_verdict.json
