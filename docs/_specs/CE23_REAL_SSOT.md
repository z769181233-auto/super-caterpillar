# CE23_REAL_SSOT.md - CE23 真实身份一致性单一真源（P15-0）

> **状态**: DRAFT (P15-0 Initial)  
> **更新时间**: 2026-01-23

## 1. 目标

通过引入真实图象 Embedding 提取与 Cosine 相似度计算，取代 P13/P14 阶段的 `real-stub` 模拟评分，从而驱动自动返工逻辑在真实画质判定下的闭环执行。

## 2. 数据契约 (Data Contract)

### 2.1 输入参数

| 参数             | 类型   | 说明                             |
| :--------------- | :----- | :------------------------------- |
| `anchorImageKey` | String | 角色锚点（参考图）的 Storage Key |
| `targetImageKey` | String | 当前分镜生成的 Asset Storage Key |
| `characterId`    | String | 角色唯一标识符                   |

### 2.2 输出结果

| 字段              | 类型   | 说明                                     |
| :---------------- | :----- | :--------------------------------------- |
| `identity_score`  | Float  | Cosine 相似度评分，区间 [0, 1]           |
| `provider`        | String | 算法提供方标识，P15-0 为 `real-embed-v1` |
| `embeddings_hash` | String | 参与计算的 Embedding 哈希值，用于审计    |
| `details`         | Object | 包含 cosine 值、版本号等调试信息         |

## 3. 判定阈值 (Pass/Fail)

- **PASS**: `identity_score >= 0.80`
- **FAIL**: `identity_score < 0.80` (触发返工流程)

## 4. 灰度策略 (Feature Flag)

- 仅当 `projects.settingsJson.ce23RealEnabled == true` 时，系统由 `real-stub` 切换为 `REAL` 逻辑。
- 默认设为 **OFF**。

## 5. 算法说明 (v1)

- **提取方式**: 本地推理提取 512d/768d 语义向量。
- **计算逻辑**: `dot_product(v1, v2) / (|v1| * |v2|)`。
- **确定性**: 固定模型版本与预处理参数，确保同一对图片在非极端场景下评分波动小于 0.001。

---

**END OF SSOT**
