# P6-2 Error Matrix (SSOT)

> **Status**: PATCH SEALED (HARDENED)
> **Primary Tag**: `P6-2_ERROR_MATRIX_PATCH_20260205_230702`
> **Evidence**: `docs/_evidence/p6_2_error_matrix_20260205_230211/`

目标：验证“故障/重试/重复回调/安全失败”情况下，系统具备正确的错误归因与**财务一致性**（Ledger 0 偏差、幂等不重复扣费）。

## 全局不变量（必须满足）

- I1：同一 (tenantId, traceId, itemType, itemId, chargeCode) **最多 1 条 POSTED**
- I2：FAILED / REJECTED / UNAUTHORIZED 不产生 POSTED
- I3：重试成功后 POSTED 恰好 1 条，且 credits 口径正确（10000 字符 = 1 Credit，ceil）
- I4：任何重复回调/重复写入被 UNIQUE 或 Writer 幂等拦截（不出现第二条 POSTED）

## Case 列表（首批）

### CASE01：Baseline 成功闭环（1 Job => 1 POSTED）

- Inject：无
- Expect：Job SUCCEEDED；Ledger POSTED = 1；credits=ceil(charCount/10000)

### CASE02：重复计费写入（幂等/唯一键拦截）

- Inject：对同一 traceId 重复触发 post
- Expect：Ledger POSTED 仍为 1（不新增）

### CASE03：安全失败（HMAC 错误/未授权）

- Inject：对关键 API 发送错误签名/无签名请求
- Expect：401/403；Ledger POSTED 增量为 0

### CASE04：处理中断恢复（Worker 中途被杀 + 重启）

- Inject：CE06 执行中 kill worker；随后重启
- Expect：最终 Job SUCCEEDED；Ledger POSTED 恰好 1；对账 0 偏差
