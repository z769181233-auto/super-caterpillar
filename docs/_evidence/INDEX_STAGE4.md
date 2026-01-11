# Stage 4 Evidence Index (Multi-Shot Pipeline)

本计划旨在建立 Stage 4 交付物及其验证证据的单一事实来源。

| 任务 ID | 任务名称 | 封板 Tag | 证据文件 | 验收命令概览 | 关键结论 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S4-6** | 单镜头 FFmpeg 渲染集成 | `seal/s4-6_ffmpeg_render_20260111` | [S4_6_FFMPEG_VERIFY_EVIDENCE_20260111.txt](file://./S4_6_FFMPEG_VERIFY_EVIDENCE_20260111.txt) | `tsx tools/verify_s4_6.ts` | 成功替代 Mock 引擎，实现 libx264/yuv420p 真实渲染。 |
| **S4-7** | 多镜头时间线管线与安全加固 | `seal/s4-7_timeline_render_20260111` | [S4_7_TIMELINE_VERIFY_EVIDENCE_20260111.txt](file://./S4_7_TIMELINE_VERIFY_EVIDENCE_20260111.txt) | `node apps/*/dist/main.js` + `verify_s4_7.ts` | 实现 CE10 编排、两段式渲染、Asset 绑定及 CE09 自动触发。解决了生产模式 DI/HMAC P0 隐患。 |

## 安全回归状态 (Security Status)
- ✅ **HMAC 验签**: API/Worker 双向对齐（100% 稳定）
- ✅ **Nonce 重放**: 经 `curl` 测试，API 成功拦截二次请求（4004 报错）
- ✅ **DI 完整性**: 确认在 `dist` 运行模式下 `emitDecoratorMetadata` 生效，核心依赖注入正常。

---
*Last Updated: 2026-01-11*
