# Stage 35: 补充证据报告

## 证据 1: Migration Diff 分析

**目的**: 证明 schema 修改不需要数据库迁移

**命令**:

```bash
cd packages/database
pnpm prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script
```

**结果**:

```
No difference detected.
```

**解释**:

- ✅ **无需迁移**: Schema 修改仅涉及 enum 值定义
- ✅ **仅客户端变更**: Prisma Client 重新生成即可
- ✅ **无隐式写库**: 不会触发任何数据库结构变更
- ✅ **安全性**: 修改前后数据库 schema 完全一致

**修改内容对照**:

- **修改**: Prisma schema enum 定义（UserRole: VIEWER→viewer 等）
- **不变**: 数据库 enum 类型及值（始终为 viewer, editor, creator, admin）
- **作用**: 使 Prisma ORM 的类型定义与数据库实际值一致

**证据文件**: `docs/_evidence/stage35/assets/migrate_diff.log`

---

## 证据 2: Membership Include vs Count 对照

**目的**: 解释 Day 2 日志中 "memberships: 0" 现象

**脚本**: `tools/evidence/stage35_membership_include_vs_count.ts`  
**测试用户**: ad@test.com

**关键发现**:

### 对照结果

```
OrganizationMember.count (where userId): 1
User.memberships.length: 0
User.organizationMembers.length: 1
```

### 根因分析

**User model 有两个关系字段**:

1. **memberships** → Membership (旧的 legacy 关系)

   ```prisma
   memberships Membership[] @relation("UserMemberships")
   ```

2. **organizationMembers** → OrganizationMember (正确的关系)
   ```prisma
   organizationMembers OrganizationMember[] @relation("UserOrganizationMember")
   ```

**Day 2 脚本使用的关系**:

```typescript
// tools/smoke/verify_stage34_day1.ts
include: {
  memberships: {
    // ❌ 错误：使用了 Membership 关系
    include: {
      organization: true;
    }
  }
}
```

**正确的关系应为**:

```typescript
include: {
  organizationMembers: {
    // ✅ 正确：OrganizationMember 关系
    include: {
      organization: true;
    }
  }
}
```

### 结论

- ✅ **memberships: 0 不是数据缺失**，而是关系字段名错误
- ✅ **OrganizationMember.count** 是权威口径，值为 1
- ✅ **User.organizationMembers** 与 count 一致，值为 1
- ⚠️ **User.memberships** 指向旧的 Membership model（已废弃或未使用）

**证据文件**: `docs/_evidence/stage35/assets/membership_include_vs_count.log`

---

## 综合评估

### Schema 修复安全性 ✅

- ✅ 无需数据库迁移
- ✅ 仅 Prisma Client 层面变更
- ✅ 不触发写库操作
- ✅ 可安全合并部署

### Day 2 "memberships: 0" 根因 ✅

- ✅ 关系字段名错误（memberships vs organizationMembers）
- ✅ 实际数据存在（count=1, organizationMembers.length=1）
- ✅ 非 Schema/Enum 问题，是业务代码使用错误关系

### 建议

1. 更新 `tools/smoke/verify_stage34_day1.ts` 使用正确关系字段
2. 考虑废弃或重命名 `User.memberships` 关系以避免混淆
3. 文档化两个关系的区别和使用场景

---

**证据补齐完成，Stage 35 可进入最终 REVIEW**
