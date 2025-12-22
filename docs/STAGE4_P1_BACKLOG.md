# Stage4 P1 Backlog（不阻断项）

## 文档说明

本文档记录 Stage4 Close-MVP 中识别出的 P1 级别待办项，这些项不影响 Stage4 关闭，但需要在后续阶段处理。

## P1 Backlog 项

### 1. Nonce TTL/清理机制（P1）

**问题描述**:
- 当前实现：依赖数据库唯一索引防重放，无自动清理机制
- 规范要求：5 分钟内不可重复，但当前实现会导致 nonce 永久不可复用

**当前实现**:
- `packages/database/prisma/schema.prisma:330-340` - `NonceStore` 表无 `expiresAt` 字段
- `apps/api/src/auth/nonce.service.ts` - 使用数据库唯一索引防重放

**建议方案**:
- **方案 A**: 在 `NonceStore` 表添加 `expiresAt` 字段，写入时设置 5 分钟后过期
- **方案 B**: 使用 Redis TTL（如果使用 Redis 存储 nonce）
- **方案 C**: 定期清理任务（cron job）删除超过 5 分钟的 nonce

**优先级**: P1（不阻断）

**状态**: ⏳ 待处理

**相关文档**:
- 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》- Nonce 5 分钟不可重复
- 《14毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec》- 时间戳有效范围（±5分钟）

---

### 2. 角色等级定义确认（P1）

**问题描述**:
- 规范要求：Owner(100)、Admin(80)、Creator(60)、Editor(50)、Viewer(20)
- 当前状态：代码中未找到明确的角色等级定义

**需要确认**:
- 数据库种子数据是否包含角色等级定义
- 角色等级是否在 `Role` 表的 `level` 字段中体现
- 权限继承链是否按等级实现

**检查位置**:
- `packages/database/prisma/schema.prisma:343-352` - `Role` 模型有 `level` 字段
- 数据库种子数据脚本（需要检查）

**优先级**: P1（不阻断）

**状态**: ⏳ 待确认

**相关文档**:
- 《16毛毛虫宇宙_用户体系与权限系统设计书_UserPermissionSpec》- 内置角色与等级

---

## Backlog 管理

### 处理原则
- P1 项不阻断 Stage4 Close-MVP
- 可在后续 Stage 中处理
- 处理前需要重新评估优先级

### 更新记录
- 2025-12-12: 创建 Backlog，记录 2 个 P1 项

---

**文档状态**: ✅ 已创建
**最后更新**: 2025-12-12

