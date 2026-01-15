# Stage 12 Security Runbook

> **适用范围**: 生产环境安全运维应急响应。

## 1. 紧急开关 (Kill-switches)

当发生严重误判或系统故障时，可通过环境变量快速关闭安全能力。

### 1.1 关闭文本安全审查 (全放行)
设置环境变量：
```bash
FEATURE_TEXT_SAFETY_TRI_STATE=false
```
**影响**: 所有文本不再进行黑白名单检查，直接 PASS（保留占位符清理），**不会**生成审计日志（Action=PASS），也不记录结果到 `text_safety_results` 表。

### 1.2 关闭 Signed URL (回退只读)
设置环境变量：
```bash
FEATURE_SIGNED_URL_ENFORCED=false
```
**影响**:
- `/api/storage/signed/:key` 接口即使签名无效也可能放行（取决于逻辑，通常用于回滚强制校验）。
- 前端需配合调整，或后端自动回退到 direct stream（如 `StorageController` 逻辑）。
- **注意**: 若 `FEATURE_SIGNED_URL_ENFORCED=true` (Stage 11)，则关闭此 flag 将允许无签名访问（若代码逻辑允许）。紧急情况下应同时检查 `STORAGE_ACCEL_REDIRECT_ENABLED` 配置。

## 2. 灰度发布与白名单

在不影响全量用户的前提下，对特定 Org 或 Project 开启安全能力。

### 2.1 针对 Org 开启文本审查
1.  确保全局 `FEATURE_TEXT_SAFETY_TRI_STATE=false` (默认关闭)。
2.  配置白名单：
    ```bash
    FEATURE_TEXT_SAFETY_TRI_STATE_ORG_WHITELIST=org-uuid-1,org-uuid-2
    ```

### 2.2 灰度放量 (Canary)
对 10% 用户开启 Signed URL 强制校验：
```bash
FEATURE_SIGNED_URL_ENFORCED=false
FEATURE_SIGNED_URL_ENFORCED_PERCENTAGE=10
```

## 3. 故障排查

### 3.1 文本审查 BLOCK 激增
**现象**: 大量用户反馈无法导入小说，Import 接口返回 422。
**排查**:
1.  检查 `/metrics` 中 `text_safety_decision_total{decision="BLOCK"}` 是否异常上升。
2.  查询 `audit_log` 表：
    ```sql
    SELECT details->>'reasons', count(*) FROM audit_log 
    WHERE action = 'TEXT_SAFETY_BLOCK' 
    AND created_at > NOW() - INTERVAL '1 hour'
    GROUP BY details->>'reasons';
    ```
3.  若确认为误判（如误封常用词），临时降级（见 1.1）或更新黑名单代码并热更。

### 3.2 Signed URL 403 错误潮
**现象**: 用户无法预览图片/视频，大量 403 / 404。
**排查**:
1.  检查 `/metrics` 中 `signed_url_access_denied_total`。
2.  检查 `process.uptime()` 确认服务未重启（密钥未轮转）。
3.  检查服务器时间 NTP 同步情况（时间偏差会导致签名验证失败）。
4.  检查 Nginx 日志 vs API 日志的关联 TraceID。

### 3.3 Fail-safe 触发告警
**监控项**: Log 关键字 `fallback to PASS` 或 `fallback to legacy`。
**动作**:
- 此时安全防护已失效（Fail-open），系统处于裸奔状态。
- 需立即排查 DB 连接 (`Prisma`) 或下游服务可用性。
