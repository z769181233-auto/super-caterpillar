# Stage 11 Feature Flags

## Flag 定义

### 1. FEATURE_SIGNED_URL_ENFORCED
- **用途**: 控制是否强制所有媒体资源返回签名 URL
- **默认值**:
  - Production: `false`
  - Staging: `true`
  - Development: `true`
- **影响范围**: 
  - `GET /api/projects/:id/structure`
  - `GET /api/assets/*`
  - 任何返回 Asset 的接口
- **行为**:
  - `true`: 响应中包含 `signedUrl` 和 `signedUrlExpiresAt` 字段
  - `false`: 仅返回 `storageKey`（向后兼容）

### 2. FEATURE_TEXT_SAFETY_TRI_STATE
- **用途**: 启用文本安全三态决策（PASS/WARN/BLOCK）
- **默认值**:
  - Production: `false`
  - Staging: `true`
  - Development: `true`
- **影响范围**: `TextSafetyService.sanitize()`
- **行为**:
  - `true`: 返回三态决策 + 落库 `TextSafetyResult`
  - `false`: 仅执行基础清洗（旧行为）

### 3. FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT
- **用途**: 控制是否在小说导入时阻止违规文本
- **默认值**:
  - Production: `false`
  - Staging: `true`
  - Development: `true`
- **依赖**: `FEATURE_TEXT_SAFETY_TRI_STATE` 必须为 `true`
- **影响范围**: `NovelSourceService.createNovelSource()`
- **行为**:
  - `true`: BLOCK 决策 -> 拒绝导入，返回 422
  - `false`: BLOCK 决策 -> 仅记录，不阻止

### 4. FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE
- **用途**: 控制是否在任务创建时阻止违规文本
- **默认值**:
  - Production: `false`
  - Staging: `true`
  - Development: `true`
- **依赖**: `FEATURE_TEXT_SAFETY_TRI_STATE` 必须为 `true`
- **影响范围**: `JobService.createNovelAnalysisJob()` 和其他任务创建入口
- **行为**:
  - `true`: BLOCK 决策 -> 拒绝创建任务，返回 422
  - `false`: BLOCK 决策 -> 仅记录，不阻止

---

## 配置方式

### 环境变量
```bash
# .env.production
FEATURE_SIGNED_URL_ENFORCED=false
FEATURE_TEXT_SAFETY_TRI_STATE=false
FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT=false
FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE=false

# .env.staging
FEATURE_SIGNED_URL_ENFORCED=true
FEATURE_TEXT_SAFETY_TRI_STATE=true
FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT=true
FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE=true

# .env.development (默认启用所有新特性)
FEATURE_SIGNED_URL_ENFORCED=true
FEATURE_TEXT_SAFETY_TRI_STATE=true
FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT=true
FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE=true
```

---

## 回滚策略

### 紧急回滚
如遇生产问题，立即设置对应 Flag 为 `false`：
```bash
# 方式 1: 修改 .env 并重启服务
FEATURE_SIGNED_URL_ENFORCED=false

# 方式 2: 通过部署平台环境变量设置（无需重启，动态加载）
kubectl set env deployment/api FEATURE_SIGNED_URL_ENFORCED=false
```

### 灰度发布
1. **Week 1**: Staging 环境启用（`true`），观察指标
2. **Week 2**: 生产环境启用 20% 流量（通过 Canary 部署 + Flag）
3. **Week 3**: 逐步扩大到 50%、100%
4. **Week 4**: Flag 默认值改为 `true`，移除 Flag 代码（Stage 12）

---

## 监控与告警

### 关键指标
- **Signed URL**:
  - 签名 URL 生成耗时（P95 < 5ms）
  - 签名 URL 过期导致的 403 错误率（< 1%）
  - 刷新签名请求 QPS
  
- **Text Safety**:
  - BLOCK 决策比例（预期 < 0.1%）
  - WARN 决策比例（预期 < 5%）
  - 文本安全审查延迟（P95 < 100ms）
  - 422 错误的用户反馈率

### 告警规则
```yaml
# Prometheus Alert
- alert: SignedUrlExpireRateHigh
  expr: rate(http_403_signed_url_total[5m]) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "签名 URL 过期导致的 403 错误率过高"

- alert: TextSafetyBlockRateHigh
  expr: rate(text_safety_block_total[1h]) > 0.01
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "文本安全 BLOCK 决策比例异常"
```
