# Stage1 用户与组织体系字段审计

**生成时间**: 2025-12-11  
**审计范围**: User / Organization / Membership / OrganizationMember / ProjectMember / Role / Permission / RolePermission  
**审计模式**: 只读审计，不修改 Schema

---

## 摘要

本文档针对用户与组织体系的 8 个核心模型进行字段级审计，识别与 DBSpec V1.1 规范的差异，分析修复必要性和迁移风险。

---

## 1. User 模型审计

### 1.1 字段对比

| 字段名                | 规范要求        | 当前实现                      | 差异          | 必要性                 |
| --------------------- | --------------- | ----------------------------- | ------------- | ---------------------- |
| id                    | String (UUID)   | String @id @default(uuid())   | ✅ 符合       | 保持                   |
| email                 | String (unique) | String @unique                | ✅ 符合       | 保持                   |
| passwordHash          | String          | String                        | ✅ 符合       | 保持                   |
| avatar                | String?         | String?                       | ✅ 符合       | 保持                   |
| userType              | Enum            | UserType @default(individual) | ✅ 符合       | 保持                   |
| role                  | Enum            | UserRole @default(viewer)     | ✅ 符合       | 保持                   |
| tier                  | Enum            | UserTier @default(Free)       | ✅ 符合       | 保持                   |
| quota                 | Json?           | Json?                         | ✅ 符合       | 保持                   |
| defaultOrganizationId | -               | String?                       | ⚠️ 规范未提及 | P2（Studio v0.7 扩展） |
| createdAt             | DateTime        | DateTime @default(now())      | ✅ 符合       | 保持                   |
| updatedAt             | DateTime        | DateTime @updatedAt           | ✅ 符合       | 保持                   |

### 1.2 关系检查

- ✅ `memberships` → Membership[]（多对多）
- ✅ `ownedProjects` → Project[]（一对多）
- ✅ `ownedOrganizations` → Organization[]（一对多）
- ✅ `billingEvents` → BillingEvent[]（一对多）
- ✅ `reviewLogs` → PublishingReview[]（一对多）
- ✅ `organizationMembers` → OrganizationMember[]（一对多）
- ✅ `apiKeys` → ApiKey[]（一对多）
- ✅ `auditLogs` → AuditLog[]（一对多）

### 1.3 索引检查

- ✅ `email @unique`（隐式索引）

### 1.4 差异分析

**无 P0/P1 级差异**，所有字段符合规范或为合理扩展。

**P2 级差异**:

- `defaultOrganizationId`: Studio v0.7 扩展字段，用于默认组织选择，不影响核心功能。

### 1.5 迁移风险

**无迁移风险**，User 模型结构稳定。

---

## 2. Organization 模型审计

### 2.1 字段对比

| 字段名    | 规范要求      | 当前实现                    | 差异          | 必要性                 |
| --------- | ------------- | --------------------------- | ------------- | ---------------------- |
| id        | String (UUID) | String @id @default(uuid()) | ✅ 符合       | 保持                   |
| name      | String        | String                      | ✅ 符合       | 保持                   |
| ownerId   | String        | String                      | ✅ 符合       | 保持                   |
| slug      | -             | String? @unique             | ⚠️ 规范未提及 | P2（Studio v0.7 扩展） |
| quota     | Json?         | Json?                       | ✅ 符合       | 保持                   |
| createdAt | DateTime      | DateTime @default(now())    | ✅ 符合       | 保持                   |
| updatedAt | DateTime      | DateTime @updatedAt         | ✅ 符合       | 保持                   |

### 2.2 关系检查

- ✅ `owner` → User（多对一，必填）
- ✅ `memberships` → Membership[]（一对多）
- ✅ `members` → OrganizationMember[]（一对多）
- ✅ `projects` → Project[]（一对多）
- ✅ `shots` → Shot[]（一对多）
- ✅ `shotJobs` → ShotJob[]（一对多）
- ✅ `tasks` → Task[]（一对多）
- ✅ `costCenters` → CostCenter[]（一对多）
- ✅ `apiKeys` → ApiKey[]（一对多）
- ✅ `billingEvents` → BillingEvent[]（一对多）

### 2.3 索引检查

- ✅ `slug @unique`（隐式索引）

### 2.4 差异分析

**无 P0/P1 级差异**，所有字段符合规范或为合理扩展。

**P2 级差异**:

- `slug`: Studio v0.7 扩展字段，用于 URL 友好标识，不影响核心功能。

### 2.5 迁移风险

**无迁移风险**，Organization 模型结构稳定。

---

## 3. Membership 模型审计

### 3.1 字段对比

| 字段名         | 规范要求      | 当前实现                    | 差异    | 必要性 |
| -------------- | ------------- | --------------------------- | ------- | ------ |
| id             | String (UUID) | String @id @default(uuid()) | ✅ 符合 | 保持   |
| userId         | String        | String                      | ✅ 符合 | 保持   |
| organizationId | String        | String                      | ✅ 符合 | 保持   |
| role           | Enum          | MembershipRole              | ✅ 符合 | 保持   |
| permissions    | Json?         | Json?                       | ✅ 符合 | 保持   |
| createdAt      | DateTime      | DateTime @default(now())    | ✅ 符合 | 保持   |
| updatedAt      | DateTime      | DateTime @updatedAt         | ✅ 符合 | 保持   |

### 3.2 关系检查

- ✅ `user` → User（多对一，必填）
- ✅ `organization` → Organization（多对一，必填）

### 3.3 索引检查

- ✅ `@@unique([userId, organizationId])`（复合唯一索引）

### 3.4 差异分析

**无差异**，Membership 模型完全符合规范。

### 3.5 迁移风险

**无迁移风险**，Membership 模型结构稳定。

---

## 4. OrganizationMember 模型审计

### 4.1 字段对比

| 字段名         | 规范要求      | 当前实现                          | 差异    | 必要性 |
| -------------- | ------------- | --------------------------------- | ------- | ------ |
| id             | String (UUID) | String @id @default(uuid())       | ✅ 符合 | 保持   |
| userId         | String        | String                            | ✅ 符合 | 保持   |
| organizationId | String        | String                            | ✅ 符合 | 保持   |
| role           | Enum          | OrganizationRole @default(MEMBER) | ✅ 符合 | 保持   |
| createdAt      | DateTime      | DateTime @default(now())          | ✅ 符合 | 保持   |
| updatedAt      | DateTime      | DateTime @updatedAt               | ✅ 符合 | 保持   |

### 4.2 关系检查

- ✅ `user` → User（多对一，必填，onDelete: Cascade）
- ✅ `organization` → Organization（多对一，必填，onDelete: Cascade）

### 4.3 索引检查

- ✅ `@@unique([userId, organizationId])`（复合唯一索引）
- ✅ `@@index([userId])`
- ✅ `@@index([organizationId])`

### 4.4 差异分析

**无差异**，OrganizationMember 模型完全符合规范（Studio v0.7 扩展）。

### 4.5 迁移风险

**无迁移风险**，OrganizationMember 模型结构稳定。

---

## 5. ProjectMember 模型审计

### 5.1 字段对比

| 字段名    | 规范要求      | 当前实现                    | 差异    | 必要性 |
| --------- | ------------- | --------------------------- | ------- | ------ |
| id        | String (UUID) | String @id @default(uuid()) | ✅ 符合 | 保持   |
| userId    | String        | String                      | ✅ 符合 | 保持   |
| projectId | String        | String                      | ✅ 符合 | 保持   |
| roleId    | String        | String                      | ✅ 符合 | 保持   |
| createdAt | DateTime      | DateTime @default(now())    | ✅ 符合 | 保持   |
| updatedAt | DateTime      | DateTime @updatedAt         | ✅ 符合 | 保持   |

### 5.2 关系检查

- ✅ `project` → Project（多对一，必填，onDelete: Cascade）
- ✅ `role` → Role（多对一，必填，onDelete: Cascade）

### 5.3 索引检查

- ✅ `@@unique([userId, projectId])`（复合唯一索引）

### 5.4 差异分析

**无差异**，ProjectMember 模型完全符合规范。

### 5.5 迁移风险

**无迁移风险**，ProjectMember 模型结构稳定。

---

## 6. Role 模型审计

### 6.1 字段对比

| 字段名    | 规范要求        | 当前实现                    | 差异    | 必要性 |
| --------- | --------------- | --------------------------- | ------- | ------ |
| id        | String (UUID)   | String @id @default(uuid()) | ✅ 符合 | 保持   |
| name      | String (unique) | String @unique              | ✅ 符合 | 保持   |
| level     | Int             | Int                         | ✅ 符合 | 保持   |
| createdAt | DateTime        | DateTime @default(now())    | ✅ 符合 | 保持   |
| updatedAt | DateTime        | DateTime @updatedAt         | ✅ 符合 | 保持   |

### 6.2 关系检查

- ✅ `members` → ProjectMember[]（一对多）
- ✅ `rolePerms` → RolePermission[]（一对多）

### 6.3 索引检查

- ✅ `name @unique`（隐式索引）

### 6.4 差异分析

**无差异**，Role 模型完全符合规范。

### 6.5 迁移风险

**无迁移风险**，Role 模型结构稳定。

---

## 7. Permission 模型审计

### 7.1 字段对比

| 字段名    | 规范要求        | 当前实现                    | 差异    | 必要性 |
| --------- | --------------- | --------------------------- | ------- | ------ |
| id        | String (UUID)   | String @id @default(uuid()) | ✅ 符合 | 保持   |
| key       | String (unique) | String @unique              | ✅ 符合 | 保持   |
| scope     | String          | String                      | ✅ 符合 | 保持   |
| createdAt | DateTime        | DateTime @default(now())    | ✅ 符合 | 保持   |
| updatedAt | DateTime        | DateTime @updatedAt         | ✅ 符合 | 保持   |

### 7.2 关系检查

- ✅ `rolePerms` → RolePermission[]（一对多）

### 7.3 索引检查

- ✅ `key @unique`（隐式索引）

### 7.4 差异分析

**无差异**，Permission 模型完全符合规范。

### 7.5 迁移风险

**无迁移风险**，Permission 模型结构稳定。

---

## 8. RolePermission 模型审计

### 8.1 字段对比

| 字段名       | 规范要求      | 当前实现                    | 差异    | 必要性 |
| ------------ | ------------- | --------------------------- | ------- | ------ |
| id           | String (UUID) | String @id @default(uuid()) | ✅ 符合 | 保持   |
| roleId       | String        | String                      | ✅ 符合 | 保持   |
| permissionId | String        | String                      | ✅ 符合 | 保持   |
| createdAt    | DateTime      | DateTime @default(now())    | ✅ 符合 | 保持   |

### 8.2 关系检查

- ✅ `role` → Role（多对一，必填，onDelete: Cascade）
- ✅ `permission` → Permission（多对一，必填，onDelete: Cascade）

### 8.3 索引检查

- ✅ `@@unique([roleId, permissionId])`（复合唯一索引）

### 8.4 差异分析

**无差异**，RolePermission 模型完全符合规范。

### 8.5 迁移风险

**无迁移风险**，RolePermission 模型结构稳定。

---

## 总结

### 字段差异统计

| 模型               | P0    | P1    | P2    | 保持   | 总计   |
| ------------------ | ----- | ----- | ----- | ------ | ------ |
| User               | 0     | 0     | 1     | 10     | 11     |
| Organization       | 0     | 0     | 1     | 6      | 7      |
| Membership         | 0     | 0     | 0     | 7      | 7      |
| OrganizationMember | 0     | 0     | 0     | 6      | 6      |
| ProjectMember      | 0     | 0     | 0     | 6      | 6      |
| Role               | 0     | 0     | 0     | 5      | 5      |
| Permission         | 0     | 0     | 0     | 5      | 5      |
| RolePermission     | 0     | 0     | 0     | 4      | 4      |
| **总计**           | **0** | **0** | **2** | **50** | **52** |

### 关系差异统计

- **符合规范**: 100%（所有关系定义正确）

### 索引差异统计

- **符合规范**: 100%（所有规范要求的索引均已实现）

### 必要性分析

**P0/P1 级差异**: 0 个  
**P2 级差异**: 2 个（User.defaultOrganizationId, Organization.slug）

**结论**: 用户与组织体系模型完全符合规范，无必须修复项。

---

## 种子数据需求

### 角色（Role）种子数据

建议初始化以下角色：

| 角色名  | Level | 说明   |
| ------- | ----- | ------ |
| viewer  | 1     | 查看者 |
| editor  | 2     | 编辑者 |
| creator | 3     | 创建者 |
| admin   | 4     | 管理员 |

### 权限（Permission）种子数据

建议初始化以下权限：

| 权限 Key         | Scope   | 说明     |
| ---------------- | ------- | -------- |
| project.read     | project | 项目查看 |
| project.write    | project | 项目编辑 |
| project.generate | project | 项目生成 |
| project.publish  | project | 项目发布 |
| project.manage   | project | 项目管理 |
| system.admin     | system  | 系统管理 |

### 角色权限（RolePermission）种子数据

建议初始化以下角色权限关联：

| 角色    | 权限                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- |
| viewer  | project.read                                                                                 |
| editor  | project.read, project.write                                                                  |
| creator | project.read, project.write, project.generate                                                |
| admin   | project.read, project.write, project.generate, project.publish, project.manage, system.admin |

---

## 迁移风险分析

### 无迁移风险

所有用户与组织体系模型结构稳定，无字段删除或类型变更，无需数据迁移。

### 种子数据初始化建议

1. **Role 种子数据**: 在首次部署时初始化 4 个基础角色
2. **Permission 种子数据**: 在首次部署时初始化 6 个基础权限
3. **RolePermission 种子数据**: 在首次部署时初始化角色权限关联

**初始化时机**: 数据库迁移时或首次启动时通过 Seed 脚本执行。

---

**文档状态**: ✅ 审计完成，无必须修复项
