# CE23_REAL_SSOT.md - CE23 真实身份一致性单一真源（P15-0）

> **状态**: SEALED (P15-0 PPV-64)  
> **更新时间**: 2026-01-23  
> **硬收口门禁**: `gate-ce23-identity-consistency-real.sh`  
> **封板证据**: `docs/_evidence/ce23_identity_real_20260123213226/`  
> **封板 Tag**: `seal/p15_0_ce23_real_ppv64_20260123`

## 1. 目标

通过引入基于图像内容像素采样的 **PPV-64 (Pixel-Perceptual-Vector)** 算法，取代 `real-stub` 模拟评分。P15-0 的定位为“内容相似度 v1”，旨在提供基于物理内容的、完全确定的、可审计的判定基础，为后续更高阶的身份识别算法奠定架构根基。

## 2. 算法规范 (PPV-64)

### 2.1 提取逻辑

- **下采样**: 采用 **8x8 cell-average downsample** 策略。
- **灰度化**: 使用固定权重的灰度计算：`gray = 0.299*R + 0.587*G + 0.114*B`。
- **网格平均**: 在原图分辨率上计算 8x8 网格内的 Cell 平均值，作为 64 维向量的基础。
- **维度**: **64** (1D Vector)。

### 2.2 确定性预处理 (Deterministic Preprocessing)

- **标准化**: `(x - mean) / (std + 1e-6)`。
- **归一化**: 执行 L2 Normalize，确保向量模长为 1，以保证 Cosine 计算的数值稳定性。

## 3. 判定契约 (Data Contract)

### 3.1 输入

- `anchorImageKey` / `targetImageKey`: Storage 索引。
- `characterId`: 校验对象标识。

### 3.2 输出

| 字段             | 类型   | 说明                                                                                                              |
| :--------------- | :----- | :---------------------------------------------------------------------------------------------------------------- |
| `identity_score` | Float  | Cosine 相似度，使用公式 `(cosine + 1) / 2` 映射至 [0, 1]                                                          |
| `provider`       | String | 固定为 `real-embed-v1`                                                                                            |
| `embedding_hash` | String | `sha256(float32_bytes)`，用于审计                                                                                 |
| `details`        | Object | 必须包含 `anchor_file_sha256`, `target_file_sha256`, `embedding_hash`, `algo_version`, `dims=64`, `score_mapping` |

## 4. 判定阈值 (Pass/Fail)

- **PASS**: `identity_score >= 0.80` (Case P 典型值: 1.0)
- **FAIL**: `identity_score < 0.80` (Case N 典型值: < 0.60)

### 4.1 门禁用例口径 (Gate Semantics)

- **Case P (Positive)**: 必须针对相同图像或完全匹配的角色，断言 `score >= 0.80` (通常应为 1.0)。
- **Case N (Negative)**: 必须针对明显不同的角色或反转图像，断言 `score < 0.80` (物理防跨度验证)。

## 5. 运营约束

- **Feature Flag**: `projects.settingsJson.ce23RealEnabled == true` 才启用 REAL。
- **默认策略**: 默认 **OFF**。

---

**END OF SSOT**
MD
