# G5 QUALITY GATE SSOT (Quality Enforcement)

> **版本**：V1.0  
> **生效范围**：G5_VIDEO_RENDER (Production)  
> **审计维度**：Image Sharpness (Laplacian Variance)

## 1. 算法定义 (Algorithm)

- **核心算法**：对灰度像素应用拉普拉斯算子 (Laplacian Kernel)，计算其方差 (Variance)。
- **审计载体**：由视频等间距提取的 30 张 PNG 关键帧 (N=30)。

## 2. 统计门禁阈值 (Hard Thresholds)

| 指标           | 统计口径               | 判定标准    | 备注                                             |
| :------------- | :--------------------- | :---------- | :----------------------------------------------- |
| **绝对锐度**   | p50 (中位数)           | **>= 360**  | 确保视频整体处于“清晰”视感区间                   |
| **锐度一致性** | p10 (低分位)           | **>= 300**  | 确保无突发性的单帧模糊 (如压缩伪影)              |
| **增益要求**   | Gain (v_hq / v_legacy) | **>= 1.3x** | 相较于 Legacy 版本必须有肉眼可见且数据可证的提升 |

## 3. 熔断机制 (Breaking Strategy)

- 任何视频若未能通过 `p50 >= 360` 这一硬性门禁，排产计划必须即刻熔断。
- FAIL 结果应记录在 `sharpness_report.json` 的 `verdict` 字段。

## 4. 环境一致性

- FFMPEG 版本 >= 6.0
- 缩放算法强制：`lanczos`
- 锐化滤镜：`unsharp=7:7:0.35:7:7:0.0`
