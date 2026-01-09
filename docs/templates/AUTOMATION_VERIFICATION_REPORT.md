# 自动化验证报告模板

**Stage**: [Stage 1 / Stage 2 / Stage 3 / Stage 4]  
**模块**: [模块名称]  
**验证日期**: YYYY-MM-DD  
**验证人**: [姓名/ID]  
**报告版本**: V1.0

---

## ⚠️ 重要说明

**这是 Close 的硬性要求之一。**

根据 `docs/LAUNCH_STANDARD_V1.1.md` 的《Verification & Close Policy》：

- ✅ **任何 Stage / 模块 / 功能的 Close，必须同时满足自动化验证全部通过 AND 人工验证 PASS**
- ✅ **缺一不可，否则一律 NOT CLOSE**
- ✅ **任何自动化验证失败，立即阻断 Close，不允许进入下一 Stage**

**本报告必须包含：**

- ✅ 脚本列表
- ✅ 执行命令
- ✅ 结果摘要（PASS / FAIL）
- ✅ 日志路径

---

## 一、验证概述

### 验证目标

[简要说明本次验证的目标和范围]

### 验证环境

- **API URL**: `http://localhost:3000`
- **Web URL**: `http://localhost:3001`
- **Database**: `postgresql://...`
- **Redis**: `redis://...`
- **Node Version**: `vXX.X.X`
- **其他关键环境变量**: [列出]

---

## 二、验证执行记录

### 2.1 工程验证（Lint / TypeCheck / Build）

| 检查项    | 命令                |       结果        | 输出文件                                       | 备注 |
| :-------- | :------------------ | :---------------: | :--------------------------------------------- | :--- |
| TypeCheck | `pnpm -r typecheck` | ✅ PASS / ❌ FAIL | `docs/_evidence/typecheck_YYYYMMDD_HHMMSS.log` |      |
| Lint      | `pnpm -r lint`      | ✅ PASS / ❌ FAIL | `docs/_evidence/lint_YYYYMMDD_HHMMSS.log`      |      |
| Build     | `pnpm -r build`     | ✅ PASS / ❌ FAIL | `docs/_evidence/build_YYYYMMDD_HHMMSS.log`     |      |

**结论**: ✅ PASS / ❌ FAIL

---

### 2.2 API 契约验证（Schema / Auth / 权限）

| 检查项      | 命令/脚本                                      |       结果        | 输出文件                                 | 备注 |
| :---------- | :--------------------------------------------- | :---------------: | :--------------------------------------- | :--- |
| Schema 对齐 | `bash tools/gate/run_launch_gates.sh` (Gate 1) | ✅ PASS / ❌ FAIL | `docs/GATEKEEPER_VERIFICATION_REPORT.md` |      |
| Auth 链路   | `bash tools/gate/run_launch_gates.sh` (Gate 2) | ✅ PASS / ❌ FAIL | `docs/GATEKEEPER_VERIFICATION_REPORT.md` |      |
| 权限验证    | `bash tools/gate/run_launch_gates.sh` (Gate 3) | ✅ PASS / ❌ FAIL | `docs/GATEKEEPER_VERIFICATION_REPORT.md` |      |

**结论**: ✅ PASS / ❌ FAIL

---

### 2.3 DB 验证（Schema / Migration / 约束）

| 检查项         | 命令/脚本                   |       结果        | 输出文件                                             | 备注 |
| :------------- | :-------------------------- | :---------------: | :--------------------------------------------------- | :--- |
| Schema 对齐    | `npx prisma validate`       | ✅ PASS / ❌ FAIL | `docs/_evidence/prisma_validate_YYYYMMDD_HHMMSS.log` |      |
| Migration 状态 | `npx prisma migrate status` | ✅ PASS / ❌ FAIL | `docs/_evidence/migrate_status_YYYYMMDD_HHMMSS.log`  |      |
| 约束检查       | [自定义脚本]                | ✅ PASS / ❌ FAIL | `docs/_evidence/constraints_YYYYMMDD_HHMMSS.log`     |      |

**结论**: ✅ PASS / ❌ FAIL

---

### 2.4 安全验证（HMAC / Nonce / Timestamp / 资产签名）

| 检查项         | 命令/脚本                                      |       结果        | 输出文件                                            | 备注 |
| :------------- | :--------------------------------------------- | :---------------: | :-------------------------------------------------- | :--- |
| HMAC 验证      | `bash tools/gate/run_launch_gates.sh` (Gate 3) | ✅ PASS / ❌ FAIL | `docs/GATEKEEPER_VERIFICATION_REPORT.md`            |      |
| Nonce 防重放   | [自定义测试]                                   | ✅ PASS / ❌ FAIL | `docs/_evidence/nonce_test_YYYYMMDD_HHMMSS.log`     |      |
| Timestamp 校验 | [自定义测试]                                   | ✅ PASS / ❌ FAIL | `docs/_evidence/timestamp_test_YYYYMMDD_HHMMSS.log` |      |
| 资产签名       | `bash tools/gate/run_launch_gates.sh` (Gate 3) | ✅ PASS / ❌ FAIL | `docs/GATEKEEPER_VERIFICATION_REPORT.md`            |      |

**结论**: ✅ PASS / ❌ FAIL

---

### 2.5 任务验证（幂等 / 重试 / 超时 / 并发）

| 检查项   | 命令/脚本                                   |       结果        | 输出文件                                         | 备注 |
| :------- | :------------------------------------------ | :---------------: | :----------------------------------------------- | :--- |
| 幂等性   | `bash tools/smoke/run_video_e2e.sh`         | ✅ PASS / ❌ FAIL | `docs/_evidence/idempotency_YYYYMMDD_HHMMSS.log` |      |
| 重试机制 | [自定义测试]                                | ✅ PASS / ❌ FAIL | `docs/_evidence/retry_YYYYMMDD_HHMMSS.log`       |      |
| 超时处理 | [自定义测试]                                | ✅ PASS / ❌ FAIL | `docs/_evidence/timeout_YYYYMMDD_HHMMSS.log`     |      |
| 并发控制 | `bash tools/load/run_capacity_benchmark.sh` | ✅ PASS / ❌ FAIL | `docs/LAUNCH_CAPACITY_REPORT.md`                 |      |

**结论**: ✅ PASS / ❌ FAIL

---

### 2.6 可观测验证（health / 日志 / 核心指标）

| 检查项       | 命令/脚本                                     |       结果        | 输出文件                                     | 备注 |
| :----------- | :-------------------------------------------- | :---------------: | :------------------------------------------- | :--- |
| Health Check | `curl http://localhost:3000/api/health/ready` | ✅ PASS / ❌ FAIL | `docs/_evidence/health_YYYYMMDD_HHMMSS.log`  |      |
| 日志输出     | [检查日志文件]                                | ✅ PASS / ❌ FAIL | `docs/_evidence/logs_YYYYMMDD_HHMMSS.log`    |      |
| Metrics 端点 | `curl http://localhost:3000/metrics`          | ✅ PASS / ❌ FAIL | `docs/_evidence/metrics_YYYYMMDD_HHMMSS.log` |      |

**结论**: ✅ PASS / ❌ FAIL

---

## 三、验证总结

### 总体结论

- ✅ **PASS**: 所有自动化验证全部通过
- ❌ **FAIL**: 存在未通过的验证项（见下方详情）

### 失败项详情

| 失败项       | 失败原因       | 影响等级 | 修复建议   |
| :----------- | :------------- | :------: | :--------- |
| [检查项名称] | [详细错误信息] | P0/P1/P2 | [修复建议] |

### 证据文件清单

- `docs/_evidence/typecheck_YYYYMMDD_HHMMSS.log`
- `docs/_evidence/lint_YYYYMMDD_HHMMSS.log`
- `docs/_evidence/build_YYYYMMDD_HHMMSS.log`
- `docs/GATEKEEPER_VERIFICATION_REPORT.md`
- `docs/LAUNCH_CAPACITY_REPORT.md`
- [其他证据文件...]

---

## 四、Close 判定

根据 `docs/LAUNCH_STANDARD_V1.1.md` 的规则：

**自动化验证结论**: ✅ PASS / ❌ FAIL

**判定**:

- ✅ **可以进入人工验证阶段**
- ❌ **必须修复失败项后重新验证**

---

**报告生成时间**: YYYY-MM-DD HH:MM:SS  
**下次验证计划**: YYYY-MM-DD
