# Stage 34 Logic & Risk Audit (Day 2)

## 1. 规则矩阵（Rule Matrix）

- Gate/Guard：是否实际执行、是否可证明生效
- RBAC：User→Org→Member→Role→Perm 链路是否可证
- Security：HMAC/Nonce/Timestamp/签名URL/限流 是否默认生效
- Observability：关键 marker 是否可统计（分子/分母齐全）

## 2. 证据文件索引

- 静态扫描：assets/day2_audit/rg_rules_map.txt
- 配置扫描：assets/day2_audit/rg_env_flags.txt
- 运行时拒绝性验证：assets/day2_audit/http_me_noauth.txt, http_me_fakebearer.txt
- DB 只读断言：assets/day2_audit/db_info.txt, \*\_count.txt, dirty_default_org_users.txt, duplicate_personal_org_owners.txt
- marker 统计脚本：tools/audit/count_markers.sh

## 3. 发现（Findings）

### 3.1 HTTP 拒绝性验证

- **规则**: 未登录访问受保护接口应返回 401/403
- **证据**: `/api/me` (no auth) → HTTP 404, `/api/me` (fake Bearer) → HTTP 404
- **结论**: 返回 404 而非 401/403，可能表示：
  - 路由不存在（需要验证路由定义）
  - Auth guard 返回 404 以隐藏资源存在性（安全策略）
- **风险等级**: P2（需要确认是否为预期行为）

### 3.2 RBAC 数据完整性断言

- **规则**: User→Org→Member 链路必须一致
- **证据**:
  - Users: 43
  - Organizations: 92
  - Members: 29
  - Dirty default org users: **0** ✅
  - Duplicate personal org owners: **0** ✅
- **结论**: RBAC 数据层完整性通过验证
- **风险等级**: ✅ PASS

### 3.3 规则实现扫描

- **静态扫描**: 2176 行匹配（AUTH_FIX, PERM_DENIED, HMAC, nonce, timestamp, rate limit, signed URL, AuditLog 等）
- **配置扫描**: 483 行匹配（DEBUG_PERM, HMAC, NONCE, TIMESTAMP, RATE_LIMIT, FEATURE flags）
- **发现**:
  - HMAC 认证配置存在（HMAC_TIMESTAMP_WINDOW, HMAC_SIGNATURE_ALGORITHM）
  - 需要验证这些规则是否默认启用（可能依赖 feature flags）

## 4. 未生效/高风险清单（P0/P1/P2）

### P1: 规则默认关闭/依赖 Feature Flags

- **发现**: HMAC_TIMESTAMP_WINDOW, HMAC_SIGNATURE_ALGORITHM 在配置中存在，但需要验证是否默认启用
- **证据**: `rg_env_flags.txt` 显示配置项存在，但未确认运行时状态
- **影响**: 如果规则默认关闭，安全防护可能未生效

### P1: 证据不可得风险（Enum/Schema 不一致）

- **发现**: Day1/Day2 已证明 Prisma include/采样会因为 enum 不一致直接失败或降级
- **影响**: 可能导致"以为某些规则没生效"，实际是"查询证据链断了"
- **建议**: 在 72h 观察期内不建议改 schema，但必须列为 P1 风险

### P2: HTTP 404 vs 401/403 语义

- **发现**: `/api/me` 在未认证时返回 404 而非 401/403
- **需要确认**: 是否为预期安全策略（隐藏资源存在性）或路由未正确配置

## 5. 修复建议（只列最小修复）

### 5.1 验证规则是否默认启用

- **操作**: 检查运行时环境变量，确认 HMAC/NONCE/TIMESTAMP 相关规则是否启用
- **影响**: 不影响 72h 观察期（只读验证）

### 5.2 确认 /api/me 路由行为

- **操作**: 检查路由定义和 auth guard 配置，确认 404 是否为预期行为
- **影响**: 不影响 72h 观察期（只读验证）

### 5.3 Enum/Schema 一致性修复（Day3+）

- **操作**: 在 72h 观察期结束后，修复 enum/schema 不一致问题
- **影响**: 需要等 Day3/观察期结束，避免影响证据收集

## 6. 执行声明

✅ **未执行任何会写 DB 的命令**

- 安全护栏: `PGOPTIONS='--default_transaction_read_only=on'`
- 审计模式: `SCU_AUDIT_MODE=1`
- 所有 DB 操作均为 SELECT 查询
- 所有 HTTP 测试均为只读请求（不触发创建操作）

## 7. 回答核心问题

### Q1: "我怎么知道逻辑有没有错/有风险？"

**答案**: 通过本审计框架输出：

1. **哪些规则能被证明生效**（有证据）
   - ✅ RBAC 数据完整性：0 dirty refs, 0 duplicates
   - ⚠️ HTTP 拒绝性：返回 404（需确认是否为预期）

2. **哪些规则只是"写在代码里"，但默认没开、或根本没被调用**（高风险）
   - ⚠️ P1: HMAC/NONCE/TIMESTAMP 配置存在，但需要验证运行时是否启用
   - ⚠️ P1: Enum/Schema 不一致可能导致证据链断裂

3. **哪些规则会在 enum/schema 不一致时直接失效**
   - P1 风险：证据不可得 / 规则验证不可重复

### Q2: "哪些规则没有生效？"

**按矩阵输出**：

1. **默认关闭（flag off）** → 第一大类
   - HMAC_TIMESTAMP_WINDOW, HMAC_SIGNATURE_ALGORITHM 需要验证运行时状态

2. **入口没接上（代码存在但路由/中间件没覆盖）** → 第二大类
   - `/api/me` 返回 404 而非 401/403（需确认路由/guard 配置）

3. **证据不可得（无日志/无审计表/不可统计）** → 第三大类
   - Enum/Schema 不一致导致 Prisma 查询失败/降级（P1 风险）
