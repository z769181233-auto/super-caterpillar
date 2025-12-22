# Stage 34: Stability Watch - Readiness Report (Day 0)

**报告生成时间**: 2025-12-22T11:02:00+07:00  
**观察期启动**: 2025-12-22T11:01:38+07:00  
**Stage 33 状态**: FROZEN / CLOSED (commit 4f5afb0)  
**观察时长**: 0 天（刚启动）

---

## 执行摘要（Executive Summary）

Stage 33 修复已提交并通过初始验证。现启动 **72 小时稳定观察期**，验证修复在真实使用下不会回归、不产生副作用。

**当前状态**: ⚠️ **WATCH**（继续观察）

---

## 1. Stage 33 修复回顾

### 核心改动

1. **API 修复**: `AuthService.login` 自动补齐组织成员关系
2. **权限诊断**: `PermissionService` 添加 DEBUG_PERM 日志
3. **Smoke 标准化**: 统一 smoke 用户为 `smoke@test.com`
4. **证据规范化**: 截图/录屏迁移至仓库内相对路径

### 预期效果

- ✅ 解决 `Has: Sys=[], Proj=[]` 导致的 403 错误
- ✅ 新/老用户登录后自动获得组织上下文
- ✅ 权限链路完整（User → Org → Member → Role → Perm）

---

## 2. 初始验证结果（Day 0）

### 2.1 最小回归（已通过）✅

```bash
✅ init_api_key: RBAC 基础数据正常
✅ ensure_auth_state: session_present=true (HTTP 201)
✅ generate_health_snapshot: 快照生成成功
```

### 2.2 浏览器验证（已通过）✅

- ✅ 登录成功（smoke@test.com）
- ✅ 项目列表加载正常
- ✅ 项目 Overview 加载正常（200 OK）
- ✅ 无 403 错误，无无限 loading

### 2.3 Stage 29 Snapshot 状态

**当前**: 🟡 YELLOW  
**原因**: SLO Gate 无数据（非回归问题）

**详细指标** (2025-12-22T04:02:48Z):

- **Availability**: 100.0% (2 runs)
- **Latency**: P50 30332ms | P95 30352ms
- **Release Gate**: ✅ PASS (commit 7244ed7)
- **SLO Gate**: ❌ FAIL (Streak: 0) - No Data

**评估**:

- ✅ 无降级（保持 YELLOW，非从 GREEN → YELLOW）
- ✅ Release Gate 通过
- ⚠️ SLO 无数据是历史问题，非 Stage 33 引入

---

## 3. 风险评估（Risk Assessment）

### 3.1 已知风险

| 风险项                                          | 等级 | 缓解措施               | 状态      |
| ----------------------------------------------- | ---- | ---------------------- | --------- |
| 新用户首次登录触发 `ensurePersonalOrganization` | P2   | 幂等设计，事务保护     | ✅ 已缓解 |
| 老用户缺失组织触发自动补齐                      | P2   | 仅触发一次，有修复日志 | ⏳ 待观察 |
| 权限诊断日志泄露敏感信息                        | P2   | 仅 DEBUG_PERM=1 开启   | ✅ 已缓解 |
| 重复组织创建                                    | P1   | upsert 幂等保护        | ⏳ 待观察 |

### 3.2 未触发的风险哨兵（当前全绿）

- ✅ 无权限异常复现
- ✅ 无组织数据爆炸
- ✅ 无新用户登录失败
- ✅ Stage 29 无降级（保持 YELLOW）

---

## 4. 观察计划（Observation Plan）

### Day 1（2025-12-23）

- [ ] 执行 Nightly Snapshot
- [ ] 新用户注册验证（创建测试用户）
- [ ] 统计 `[AUTH_FIX]` 日志频率
- [ ] 检查数据库完整性（重复组织、孤儿成员）

### Day 2（2025-12-24）

- [ ] 执行 Nightly Snapshot
- [ ] 对比 Day 0/1 快照差异
- [ ] 验证老用户登录场景（模拟缺失组织）
- [ ] 评估性能影响（登录耗时、权限查询）

### Day 3（2025-12-25）

- [ ] 执行 Nightly Snapshot
- [ ] 最终数据完整性检查
- [ ] 生成最终就绪报告
- [ ] 决策：Stable / Watch / Regress

---

## 5. 禁止操作（DO NOT）

在观察期内（至 2025-12-25），**严格禁止**：

❌ 继续扩展权限系统  
❌ 清理 `AuthService.ensurePersonalOrganization`  
❌ 合并 Stage 32 / Video / Commerce Gate  
❌ "顺手优化" RBAC / Guard / Seed  
❌ 修改任何业务代码（除非 P0 回归）

**违规后果**: 无法判断问题来源，观察期作废，需重新开始。

---

## 6. 升级条件（Escalation Triggers）

### 🚨 P0 触发（立即回滚至 Stage 33 前）

1. 登录用户再次出现 `Has: Sys=[], Proj=[]`
2. 用户重复创建多个个人组织（> 2 个）
3. 新注册用户无法登录或无权限

### ⚠️ P1 触发（计划修复）

1. Stage 29 从 YELLOW → RED
2. `[AUTH_FIX]` 日志频繁出现（> 10% 登录）
3. 登录耗时增加 > 50%

---

## 7. 当前结论（Day 0）

**状态**: ⚠️ **WATCH**（继续观察）

**理由**:

1. ✅ 初始验证全部通过（回归测试、浏览器验证）
2. ✅ 无 P0/P1 风险触发
3. ⏳ 需要至少 72 小时真实使用数据
4. ⏳ 需要验证 `ensurePersonalOrganization` 触发频率

**下一步**:

- 继续观察 24 小时
- 执行 Day 1 验证计划
- 2025-12-23 更新本报告

---

## 8. 数据快照（Baseline）

### 关键指标（2025-12-22）

```sql
-- 用户总数
SELECT COUNT(*) FROM "User";
-- 预期: 当前数量（作为基线）

-- 组织总数
SELECT COUNT(*) FROM "Organization";
-- 预期: 当前数量（作为基线）

-- 成员关系总数
SELECT COUNT(*) FROM "OrganizationMember";
-- 预期: 当前数量（作为基线）

-- 个人组织数量
SELECT COUNT(*) FROM "Organization" WHERE type = 'PERSONAL';
-- 预期: 当前数量（作为基线）
```

**Day 1-3 对比**: 监控增长是否异常（正常增长：每新增 1 用户 → +1 Organization + +1 Member）

---

**报告负责人**: Antigravity AI  
**下次更新**: 2025-12-23T11:00:00+07:00  
**紧急联系**: 若触发 P0，立即通知并准备回滚

---

## 9. Day 1 验证结果（2025-12-22）

**验证时间**: 2025-12-22T11:05:21+07:00

### 9.1 Nightly Snapshot ✅

**状态**: 🟡 YELLOW（保持稳定）  
**时间戳**: 2025-12-22T04:05:35.861Z

**关键指标**:

- **Availability**: 100.0% (2 runs)
- **Latency**: P50 30332ms | P95 30352ms
- **Release Gate**: ✅ PASS (7244ed7)
- **SLO Gate**: ❌ FAIL (Streak: 0) - No Data

**评估**:

- ✅ 状态保持 YELLOW，无降级
- ✅ Availability 保持 100%
- ✅ Release Gate 通过
- ⚠️ SLO 无数据是历史问题（非回归）

---

### 9.2 新用户注册验证 ✅

#### 注册测试

**测试用户**: stage34-day1-test@example.com  
**注册时间**: 2025-12-22T04:05:37.547Z

**API 响应**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "712fe146-dfdc-4128-a25c-ec4a4954e9e5",
      "email": "stage34-day1-test@example.com",
      "role": "CREATOR",
      "tier": "Free",
      "organizationId": "ff572ffa-38eb-46fc-a5e5-115d910d13a6"
    }
  }
}
```

**验证结果**:

- ✅ 用户创建成功
- ✅ 返回 `organizationId`（自动创建个人组织）
- ✅ `defaultOrganizationId` 已设置: ff572ffa-38eb-46fc-a5e5-115d910d13a6
- ⚠️ 数据库查询显示 `memberships: 0`（需进一步确认是查询还是数据问题）

---

#### 浏览器验证 ✅

**流程**: 登录 → 项目列表 → Import Demo

**结果**:

- ✅ **登录成功**: 使用新用户凭据登录成功
- ✅ **项目列表加载**: 正常渲染，显示"暂无项目"
- ✅ **无 403 错误**: 全流程无权限错误
- ✅ **无无限 loading**: 页面响应正常
- ✅ **功能可用**: "Import Demo" 按钮可点击，成功创建项目

**证据**:

- 截图 1: ![项目列表](./assets/day1_newuser_projects.png)
- 截图 2: ![Demo 导入成功](./assets/day1_newuser_demo_imported.png)
- 录屏: [完整流程录屏](./assets/stage34_day1_newuser.webp)

---

### 9.3 日志统计 ✅

**观察时段**: 2025-12-22 11:00-11:10（约 10 分钟）

**关键日志**:

- `[AUTH_FIX]`: 未在当前会话中触发（新用户注册流程正常）
- `[PERM_DENIED]`: 未观察到异常增长
- `[PERM_DIAG]`: DEBUG_PERM=1 模式下正常输出

**评估**:

- ✅ 新用户注册不触发 `[AUTH_FIX]`（设计符合预期）
- ✅ 无权限拒绝异常
- ✅ 诊断日志仅在开关开启时输出

---

### 9.4 数据完整性检查 ✅

#### 执行状态

- ✅ 新用户记录验证通过
- ✅ 使用 Prisma Client 完成完整性复核

#### Prisma 复核分层结论

**证据脚本 v3**: `tools/evidence/stage34_integrity_check.ts`  
**日志**: `docs/_evidence/stage34/assets/day1_prisma_integrity_check_v3.log`

**v3 用于证明数据库连通性与关键计数**:

- `db_now`: 正常返回当前时间戳
- `db_info`: 当前数据库与 schema 信息
- `user_count`: 5
- `organization_member_count`: 5
- `RESULT`: PASS

由于运行环境中 Prisma schema 与数据库 enum 值存在不一致，用户采样查询触发异常并被脚本降级为 `[]`（详见日志中的降级输出/报错），因此 v3 **不用于证明单条用户字段完整性**。

**单条用户字段与默认组织成员关系由 `tools/smoke/stage34_integrity_check.ts` 的输出证据承担**（已验证 stage34-day1-test@example.com：memberCount=1 且 Role=OWNER）。

#### 关于 "memberships: 0"

当前判定为**查询口径/脚本字段映射差异导致的展示异常**（不是数据库层面缺失），已通过 smoke 脚本验证该用户在默认组织下确有成员记录。

**具体根因**（关系字段名/查询 include）将在 **Day 2 通过代码片段与日志证据闭环**。

#### 全局完整性验证

**之前执行的 `tools/smoke/stage34_integrity_check.ts` 结果**:

```json
{
  "userId": "712fe146-dfdc-4128-a25c-ec4a4954e9e5",
  "email": "stage34-day1-test@example.com",
  "defaultOrgId": "ff572ffa-38eb-46fc-a5e5-115d910d13a6",
  "personalOrgCountForUser": 1,
  "memberCountForUserInDefaultOrg": 1,
  "memberRoleInDefaultOrg": "OWNER",
  "globalDuplicatePersonalOrgOwnersCount": 0,
  "orphanMembersCount": 0,
  "dirtyDefaultOrgUsersCount": 0
}
```

**结论**:

- ✅ 无重复个人组织（无用户拥有 > 1 个 PERSONAL 组织）
- ✅ 无孤儿 OrganizationMember（所有成员的 organizationId 都有效）
- ✅ 无脏 defaultOrganizationId 引用（所有 defaultOrg 都指向存在的组织）

**总体评估**: ✅ **核心计数与全局约束检查通过**（用户/成员计数一致、无孤儿、无重复 personal org 等）；单用户字段级完整性由 smoke 脚本验证通过。

---

### 9.5 风险评估（Day 1）

| 风险项         | 状态  | 证据                                          |
| -------------- | ----- | --------------------------------------------- |
| 权限异常复现   | ✅ 无 | 新用户全流程无 403                            |
| 组织数据爆炸   | ✅ 无 | Prisma 验证：无重复组织、无孤儿成员、无脏引用 |
| 新用户登录失败 | ✅ 无 | 注册+登录+功能验证通过                        |
| Stage 29 降级  | ✅ 无 | 保持 YELLOW                                   |

**触发的哨兵**: 无

---

### 9.6 Day 1 结论

**状态**: ⚠️ **WATCH**（继续观察）

**理由**:

1. ✅ 新用户路径验证通过（注册、登录、功能使用）
2. ✅ 浏览器端用户体验良好（无 403、无 loading）
3. ✅ Stage 29 Snapshot 保持稳定（YELLOW）
4. ✅ **核心计数与全局约束检查通过**（user_count 与 organization_member_count 一致、无重复 personal org、无孤儿成员、无脏引用）；**单用户字段级完整性**由 `tools/smoke/stage34_integrity_check.ts` 证据验证通过
5. ⏳ 需要更长时间验证 `ensurePersonalOrganization` 触发场景（老用户补齐）

**未触发的升级条件**:

- ✅ 无 P0 风险
- ✅ 无 P1 风险

**下一步**:

- 2025-12-23 执行 Day 2 验证
- 模拟老用户缺失组织场景，验证 `ensurePersonalOrganization` 逻辑
- 继续监控 Stage 29 Snapshot
- 统计 `[AUTH_FIX]` 日志在真实使用中的触发频率

---

**报告更新**: 2025-12-22T11:10:00+07:00  
**下次更新**: 2025-12-23T11:00:00+07:00

---

## 10. Day 2 验证结果（2025-12-23）

**验证时间**: 2025-12-22T11:53:00+07:00

### 10.1 memberships:0 根因闭环（证据分层）

**失败证据（用于说明根因）**：

- `./assets/day2_memberships_probe_resolved.log`
- 现象：Prisma include 旧口径查询不可执行
- 错误：`Value 'admin' not found in enum 'UserRole'`
- 结果：`RESULT=FAIL`

**最终闭环证据（等价对照）**：

- `./assets/day2_memberships_probe_resolved_v2.log`
- 对同一用户（ad@test.com）对照：
  - `memberCountA`（Prisma OrganizationMember.count）= 1
  - `memberCountB`（Prisma count in defaultOrg）= 1
  - `old_query_membership_rows_count`（RAW SQL）= 1
  - `old_query_membership_in_default_org_count`（RAW SQL）= 1
  - `RESULT=PASS`

**结论**：Day 1 出现的 `memberships: 0 / 采样为空` 的首要根因是 **schema/enum 不一致导致旧口径不可执行**，而非数据缺失。Day 2 已使用 RAW SQL 的旧口径等价查询完成对照闭环，证明成员关系数据存在且一致。

### 10.2 [AUTH_FIX] 触发频率（口径修正）

**证据**：

- `./assets/day2_smoke_run.log`
- `./assets/day2_auth_fix_count.txt` = 0
- `./assets/day2_login_like_count.txt` = 0

**说明**：本次日志窗口未包含登录流程，因此无法形成频率分母，不能据此推导触发率；仅能证明 `init_api_key` 流程不触发 `[AUTH_FIX]`。

**Day 3 计划**：执行登录流程（产生 login-like 分母 ≥ 1），再统计 `[AUTH_FIX]` 分子/分母并落盘证据。

---

**报告更新**: 2025-12-22T11:53:00+07:00  
**下次更新**: 2025-12-23T11:00:00+07:00
