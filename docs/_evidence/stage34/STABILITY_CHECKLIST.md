# Stage 34: Stability Watch Window - Observation Checklist

**观察期启动**: 2025-12-22T11:01:38+07:00  
**Stage 33 状态**: FROZEN / CLOSED  
**观察目标**: 验证 Stage 33 修复在真实使用下不会回归、不产生副作用

---

## 1. 观察维度（Observation Dimensions）

### 1.1 登录路径（Login Paths）

#### 新用户注册

- [ ] 新用户注册后是否自动创建个人组织
- [ ] 新用户首次登录是否成功（无 403）
- [ ] 新用户能否正常访问项目列表
- [ ] 新用户能否正常访问项目 Overview
- [ ] 新用户能否创建新项目

**验证方式**:

```bash
# 1. 创建新测试用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test-stage34@example.com","password":"test123"}'

# 2. 检查数据库
psql $DATABASE_URL -c "SELECT u.email, om.role, o.name FROM \"User\" u
  LEFT JOIN \"OrganizationMember\" om ON u.id = om.\"userId\"
  LEFT JOIN \"Organization\" o ON om.\"organizationId\" = o.id
  WHERE u.email = 'test-stage34@example.com';"
```

**预期**:

- 用户创建成功
- `OrganizationMember` 记录存在，role = 'OWNER'
- `Organization` 为 PERSONAL 类型

---

#### 老用户登录（缺失组织成员关系）

- [ ] `ensurePersonalOrganization` 是否被触发
- [ ] 触发频率是否合理（仅首次补齐）
- [ ] 补齐后用户能否正常使用

**验证方式**:

```bash
# 观察 API 日志中的 [AUTH_FIX] 记录
# 预期：仅在用户真的缺失组织时出现，非频繁触发
```

---

### 1.2 自动创建组织逻辑（Org Auto-Creation）

#### 监控指标

- [ ] `[AUTH_FIX]` 日志出现频率
- [ ] 是否存在重复组织创建
- [ ] 是否存在孤儿 OrganizationMember（无对应 Organization）
- [ ] 是否存在脏数据（user.defaultOrganizationId 指向不存在的组织）

**验证方式**:

```sql
-- 检查重复个人组织
SELECT "ownerId", COUNT(*) as org_count
FROM "Organization"
WHERE type = 'PERSONAL'
GROUP BY "ownerId"
HAVING COUNT(*) > 1;

-- 检查孤儿成员
SELECT om.id, om."userId", om."organizationId"
FROM "OrganizationMember" om
LEFT JOIN "Organization" o ON om."organizationId" = o.id
WHERE o.id IS NULL;

-- 检查脏 defaultOrg
SELECT u.id, u.email, u."defaultOrganizationId"
FROM "User" u
LEFT JOIN "Organization" o ON u."defaultOrganizationId" = o.id
WHERE u."defaultOrganizationId" IS NOT NULL AND o.id IS NULL;
```

**预期**:

- ✅ 无重复个人组织
- ✅ 无孤儿成员
- ✅ 无脏 defaultOrg 引用

---

### 1.3 浏览器端用户体验（Browser UX）

#### 关键路径

- [ ] 登录成功率（无 403）
- [ ] 项目列表加载（无无限 loading）
- [ ] 项目 Overview 加载（200 OK）
- [ ] 创建项目功能可用
- [ ] 无权限相关错误提示

**验证方式**:

```bash
# 浏览器手动验证
# 1. 访问 http://localhost:3001/zh/login
# 2. 使用 smoke@test.com 登录
# 3. 检查项目列表
# 4. 进入任意项目 Overview
# 5. 尝试创建新项目
```

**预期**:

- ✅ 全流程无阻塞
- ✅ 无 `Has: Sys=[], Proj=[]` 错误
- ✅ 无无限 loading 或白屏

---

### 1.4 权限系统稳定性（Permission Stability）

#### 监控项

- [ ] `[PERM_DENIED]` 日志是否异常增加
- [ ] `[PERM_DIAG]` 日志输出是否符合预期（仅 DEBUG_PERM=1）
- [ ] 权限链路是否稳定（User → Org → Member → Role → Perm）

**验证方式**:

```bash
# 设置 DEBUG_PERM=1 并观察一次完整登录流程
DEBUG_PERM=1 pnpm --filter api dev

# 登录并访问项目
# 检查日志输出
```

**预期**:

- ✅ 权限链路完整（Memberships > 0, Total > 0）
- ✅ 无异常权限拒绝
- ✅ 调试日志仅在开关开启时输出

---

## 2. Nightly 观察（Stage 29 Snapshot）

### 执行频率

- 每日至少 1 次（建议：每晚 23:00）

### 执行命令

```bash
pnpm -w exec tsx tools/smoke/generate_health_snapshot.ts
```

### 观察指标

- ✅ Snapshot 生成成功（无报错）
- ✅ 关键指标无降级（不要求全 GREEN，但不能从 GREEN → YELLOW/RED）
- ✅ 无新增异常项

### 记录格式

```
2025-12-22: ✅ Snapshot OK
2025-12-23: ✅ Snapshot OK
2025-12-24: ⚠️ User count mismatch (非阻塞)
```

---

## 3. 风险哨兵（Escalation Triggers）

### 🚨 若以下任一条件触发，立即升级至 Stage 35（回归修复）

#### P0 触发条件（立即回滚）

1. **权限异常复现**:
   - 登录用户再次出现 `Has: Sys=[], Proj=[]`
   - 大面积 403 Forbidden 错误
2. **组织数据爆炸**:
   - 用户重复创建多个个人组织（> 2 个）
   - `OrganizationMember` 表异常增长（每用户 > 3 条）
3. **新用户登录失败**:
   - 新注册用户无法登录
   - 新用户登录后无权限访问任何资源

#### P1 触发条件（监控并计划修复）

1. **Stage 29 指标降级**:
   - 任何已 GREEN 的项从 GREEN → YELLOW/RED
   - 连续 3 天 YELLOW 无改善
2. **日志异常**:
   - `[AUTH_FIX]` 日志频繁出现（> 10% 登录触发）
   - `[PERM_DENIED]` 异常增长（> 基线 2 倍）

3. **性能降级**:
   - 登录耗时增加 > 50%
   - 权限查询导致数据库负载增加 > 30%

---

## 4. 观察期结束条件

### ✅ Stable（可进入商业阶段）

- 连续 **3 天**无 P0/P1 触发
- Stage 29 Snapshot 稳定（无降级）
- 浏览器端用户体验良好（无 403/loading）
- 无组织数据异常

### ⚠️ Watch（继续观察）

- 出现 **P1 触发**但已控制
- Stage 29 有 YELLOW 但未恶化
- 需要更长时间验证稳定性

### ❌ Regress（必须回滚或修复）

- 出现 **P0 触发**
- Stage 29 从 GREEN → RED
- 用户无法正常使用核心功能

---

## 5. 观察日志（Observation Log）

### 2025-12-22

- ✅ Stage 33 提交成功（commit 4f5afb0）
- ✅ 最小回归通过（init_api_key, ensure_auth_state, health_snapshot）
- ✅ 浏览器验证通过（登录、项目列表、Overview）
- ⏳ 开始 24 小时稳定观察

### 2025-12-23

- [ ] Nightly Snapshot 执行
- [ ] 新用户注册验证
- [ ] `[AUTH_FIX]` 日志频率统计

### 2025-12-24

- [ ] Nightly Snapshot 执行
- [ ] 数据完整性检查（重复组织、孤儿成员）

---

## 6. 禁止操作清单（DO NOT）

在观察期内，**严格禁止**以下操作：

❌ 继续扩展权限系统  
❌ 清理 `AuthService.ensurePersonalOrganization`  
❌ 合并 Stage 32 / Video / Commerce Gate  
❌ "顺手优化" RBAC / Guard / Seed  
❌ 修改任何业务代码（除非 P0 回归）

**原因**: 任何改动都会破坏刚刚稳定的系统信号，无法判断问题是来自 Stage 33 修复还是新改动。

---

**观察期负责人**: Antigravity AI  
**预计结束时间**: 2025-12-25T11:00:00+07:00（72 小时后）  
**状态更新频率**: 每日至少 1 次
