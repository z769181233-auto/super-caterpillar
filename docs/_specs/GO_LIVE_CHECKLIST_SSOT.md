# V3 Go-Live Checklist SSOT

本文件定义了 Super Caterpillar V3 生产环境发布的强制性准入标准、关键配置及关键资产清单。任何发布行为必须 100% 通过此清单。

## 1. 强制依赖门禁 (Dependency Gates)

| 门禁编号  | 描述                                       | 状态要求    | 证据锚点                        |
| :-------- | :----------------------------------------- | :---------- | :------------------------------ |
| **P9**    | Contract Alignment (API 契约一致性)        | ✅ REQUIRED | `docs/_evidence/p9_contract/`   |
| **P10.1** | Receipt Integrity (生产凭据回执验证)       | ✅ REQUIRED | `docs/_evidence/p10_1_receipt/` |
| **P11-2** | Capacity & Load SLO (负载与时延标准)       | ✅ REQUIRED | `docs/_evidence/p11_2_load/`    |
| **P11-3** | Release & Rollback (发布演练与回滚)        | ✅ REQUIRED | `docs/_evidence/v3_rollback/`   |
| **P11-1** | Ops Dashboard & Metrics (运维观测性)       | ✅ REQUIRED | `docs/_evidence/p11_1_metrics/` |
| **P11-4** | Operational Switches (功能开关与 503 截断) | ✅ REQUIRED | `docs/_evidence/p11_4_ff/`      |

## 2. 核心环境变量清单 (Critical Envs)

| 变量名                             | 安全级别 | 生产推荐值     | 描述                           |
| :--------------------------------- | :------- | :------------- | :----------------------------- |
| `DATABASE_URL`                     | P0       | REQUIRED       | 生产数据库链接                 |
| `API_SECRET_KEY`                   | P0       | REQUIRED       | HMAC 签名主密钥 (不可泄露)     |
| `GATE_MODE`                        | P0       | `0` (生产必须) | 门禁模式，生产环境必须显式置 0 |
| `ALLOW_DATABASE_DESTRUCTIVE_CLEAN` | P0       | `false`        | 防止 `TRUNCATE` 的最终锁       |
| `NODE_ENV`                         | P1       | `production`   | 运行环境标识                   |
| `ENABLE_INTERNAL_JOB_WORKER`       | P1       | `true`         | 是否启动内置 Worker 进程       |

## 3. 关键引擎清单 (Engine SSOT)

以下引擎定义为 **CRITICAL**。若其处于离线或异常状态，系统必须触发 503 `ERR_ENGINE_OFFLINE` 或告警拦截。

- **default_novel_analysis** (CE06): 核心剧本解析引擎
- **default_shot_render** (CE05): 开发/预览渲染引擎
- **real_shot_render** (CE05): 商业级 1:1 渲染引擎
- **character_visual** (CE11): 角色视觉一致性引擎

## 4. 上线最后 3 件事 (Pre-Flight Lock)

1.  **Ops 隔离**: `/api/ops/metrics` 必须绑定 `ADMIN` 角色，且禁止从公网直接访问。
2.  **清理开关**: 生产环境下 `ALLOW_DATABASE_DESTRUCTIVE_CLEAN` 必须硬编码或通过配置强制设为 `false`。
3.  **回滚点**: 当前已知最稳定的 Tag 为 `seal/v3_production_ops_ready_20260120`。
