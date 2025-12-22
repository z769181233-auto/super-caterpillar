# Stage 35 文档修订日志

修订时间: 2025-12-22T14:20:00+07:00
修订人: Antigravity AI

## P0-1: 删除 "DB Pull 局限性" 不成立叙述

**原表述** (已删除):

- "db pull 不会分析表数据中实际使用的 enum 值...会遗漏"

**删除理由**:

- Enum 值属于 DDL 类型定义，应从 pg_enum 读取
- 该表述在 PostgreSQL + Prisma 语义下不成立
- 会被审计否决

## P0-2: 删除 "Schema 大小写" 矛盾叙述

**原表述** (已删除):

- "db pull 后 schema 大写 OWNER/ADMIN..."
- "Prisma 期望大写"

**删除理由**:

- 与"数据库实际小写"矛盾
- 制造审计疑问
- 无法自洽

## 新增权威证据

1. enum_research.log - pg_enum 查询结果（小写）
2. migrate_diff_final.log - Schema 一致性检查
3. enum_verification_after_dbpull.log - 运行时验证通过
4. membership_include_vs_count_after_fix.log - 关系字段对照

## 修正后结论

- Schema 使用小写 enum 与数据库定义一致
- 能够正常解码所有现有数据
- 工具脚本已修正（organizationMembers）
- 无需数据库迁移

## 约束遵守

✅ 只读、不写库、不合并、不部署
