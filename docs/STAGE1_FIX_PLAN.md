# Stage1 修复计划

**生成时间**: 2025-12-11  
**最后更新**: 2025-12-11  
**修复范围**: Prisma Schema、API 安全链路、审计日志覆盖

---

## 修复项列表

| ID | 模块 | 文件路径 | 修改类型 | 摘要 | 优先级 | 是否已完成 |
|----|------|---------|---------|------|---------|-----------|
| S1-1 | Prisma Schema | `packages/database/prisma/schema.prisma` | 修改 | 为 Season 模型添加 @deprecated 注释，确保 Episode 可直接关联 Project | P1 | ✅ 已完成 |
| S1-2 | API 安全 | `apps/api/src/auth/hmac/**` | 检查/修改 | 检查并确保 HMAC Guard 完整实现 Nonce/Timestamp 校验 | P0 | ✅ 已符合（HmacAuthService 已完整实现） |
| S1-3 | API 安全 | `apps/api/src/worker/**` | 检查/修改 | 确保所有 Worker 相关接口使用 JwtOrHmacGuard | P0 | ✅ 已符合（WorkerController 已使用 JwtOrHmacGuard） |
| S1-4 | API 安全 | `apps/api/src/job/**` | 检查/修改 | 确保所有 Job 相关接口使用 JwtOrHmacGuard | P0 | ✅ 已符合（JobController 关键接口已使用 JwtOrHmacGuard） |
| S1-5 | API 安全 | `apps/api/src/engine-profile/**` | 检查 | 确认 EngineProfile API 安全链路（只读接口可用 JWT） | P1 | ✅ 已符合（EngineProfileController 使用 JwtOrHmacGuard） |
| S1-6 | 审计日志 | `apps/api/src/project/**` | 检查/修改 | 确保所有 Project/Episode/Scene/Shot CRUD 操作写入审计日志 | P0 | ✅ 已完成（已为 createEpisode/createScene/updateScene/createShot/updateShot/deleteProject 添加审计日志） |
| S1-7 | 审计日志 | `apps/api/src/auth/**` | 检查/修改 | 确保登录/退出操作写入审计日志 | P0 | ✅ 已符合（AuthController 已使用 AuditInterceptor） |
| S1-8 | 审计日志 | `apps/api/src/job/**` | 检查/修改 | 确保任务创建/执行操作写入审计日志 | P0 | ✅ 已符合（JobController 和 WorkerController 已记录审计日志） |
| S1-9 | 错误码 | `apps/api/src/auth/hmac/**` | 检查/修改 | 统一错误码为 4003/4004 | P1 | ✅ 已符合（HmacAuthService 已使用 4003/4004 错误码） |

---

## 修复说明

### S1-1: Prisma Schema Season 模型标记
- **目标**: 不删除 Season 模型（避免破坏现有数据），但标记为 deprecated
- **修改内容**: 在 Season 模型上添加注释说明，确保 Episode 可直接关联 Project

### S1-2: HMAC Guard Nonce/Timestamp 校验
- **目标**: 确保 HMAC 认证完整实现 Nonce 防重放和 Timestamp 时间窗校验
- **修改内容**: 检查 `HmacAuthGuard` 实现，补齐缺失的校验逻辑

### S1-3/S1-4: Worker/Job 接口安全
- **目标**: 确保所有 Worker/Job 相关接口都使用 `JwtOrHmacGuard`
- **修改内容**: 检查并更新相关 Controller，确保使用正确的 Guard

### S1-5: EngineProfile API 安全
- **目标**: 确认只读统计接口的安全策略（可使用 JWT，无需强制 HMAC）
- **修改内容**: 检查当前实现，确认符合规范

### S1-6/S1-7/S1-8: 审计日志覆盖
- **目标**: 确保所有关键操作都写入审计日志
- **修改内容**: 检查并补齐缺失的审计日志写入

### S1-9: 错误码统一
- **目标**: 统一 API 错误码，确保符合 APISpec
- **修改内容**: 检查并更新错误码定义

---

**文档状态**: ✅ 计划完成，待执行修复

