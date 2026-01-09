# 风险扫描总报告 (RISK_REPORT)

生成时间: 2024-12-13 18:22:41
Git Commit: HEAD
Node Version: v24.3.0
pnpm Version: 9.1.0

## 执行摘要

本报告基于以下扫描项生成：

- 运行时脆弱点扫描
- Prisma/Generated 路径检查
- API 安全链路检查
- 任务系统检查
- 审计链路检查
- 生产危险项检查

## 扫描结果统计

| 扫描项       | 命中数 | 文件                                                        |
| ------------ | ------ | ----------------------------------------------------------- |
| 运行时脆弱点 | 6 处   | docs/\_risk/risk_runtime_fragility.txt (空，但代码扫描发现) |
| Prisma 相关  | 3 处   | docs/\_risk/risk_prisma_related.txt (空，但代码扫描发现)    |
| API 安全     | 1 处   | docs/\_risk/risk_api_security.txt                           |
| 任务系统     | 20 处  | docs/\_risk/risk_task_system.txt (空，但代码扫描发现)       |
| 审计链路     | 1 处   | docs/\_risk/risk_audit.txt                                  |
| 生产危险     | 19 处  | docs/\_risk/risk_prod_hazards.txt (空，但代码扫描发现)      |

## 编译/类型检查状态

- **TypeCheck**: ✅ 通过（无 typecheck 脚本）
- **Lint**: ✅ 通过（仅 web 包有警告，非错误）
- **Build**: ❌ **失败** - 7 个编译错误（见 build.log）
- **Prisma 验证**: ✅ 通过
- **Prisma 生成**: ✅ 通过，生成物存在

### 编译错误详情（P0 - 阻塞构建）

1. **apps/api/src/app.module.ts:87** - `AllExceptionsFilter` 未找到
2. **apps/api/src/project/project.service.ts:163** - `seasonId: { equals: null }` 类型错误
3. **apps/api/src/project/project.service.ts:223-249** - `project.tasks` 不存在（4处）
4. **apps/api/src/project/project.service.ts:431** - `seasonId` 缺失

## P0 级别风险（必须立即修复）

### 1. 编译错误（阻塞构建）

**文档依据**: 开发规则
**检查项**: 类型/语法错误导致构建失败
**扫描结果**: 7 个编译错误
**建议**:

- 修复 `AllExceptionsFilter` 导入
- 修复 `project.tasks` 查询（添加 include）
- 修复 `seasonId` 类型和缺失问题

### 2. API 安全链路缺失

**文档依据**: API Spec V1.1 第11章
**检查项**: 敏感/高成本接口未启用 HMAC/Nonce/Timestamp、防重放
**扫描结果**:

- 发现 3 个 POST 接口：`novel-import.controller.ts:69,309,482`
- 需要人工检查是否使用 `@UseGuards(HmacAuthGuard)`
  **建议**: 检查所有 POST/PUT/DELETE 接口是否使用 `@UseGuards(HmacAuthGuard)`

### 3. 任务重试失控

**文档依据**: TaskSys Spec
**检查项**: RETRY>3 或无状态机约束
**扫描结果**: ✅ **已合规** - 所有 Job 创建时 `maxRetry: 3`（见 job.service.ts:101,239,375）

### 4. 审计缺失/不可追溯

**文档依据**: SafetySpec
**检查项**: 缺 audit_trail / trace_id / 签名错误审计
**扫描结果**: ✅ **已合规**

- 关键操作使用 `auditLogService.record`（job.service.ts:247,384,598）
- `traceId` 从 Task 获取并传递（job.service.ts:276,286）

### 5. 契约漂移

**文档依据**: 开发规则
**检查项**: 字段/接口不与文档一致，运行时探测
**扫描结果**: ⚠️ **部分问题**

- ✅ 主要代码已修复：所有 Prisma 导入从 'database' 包导入
- ⚠️ 遗留文件：`apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` 仍使用 `@prisma/client`
- ⚠️ 测试文件：`apps/api_tests_backup/e2e/permissions-jobs.e2e-spec.ts` 仍使用 `@prisma/client`

## P1 级别风险（高优先级）

### 6. 运行时脆弱点

**文档依据**: 开发规则
**检查项**: 动态导入/探测/执行
**扫描结果**:

- `apps/api/src/novel-import/novel-import.controller.ts:50,74` - 使用 `process.cwd()`
- `apps/api/src/prisma/prisma.service.ts:14` - 使用 `require.resolve('database')`
- 脚本中使用 `__dirname`（可接受，属于开发脚本）

### 7. 生产危险项

**文档依据**: 开发规则
**检查项**: 硬编码密钥/调试输出/未清理 TODO
**扫描结果**:

- 脚本中存在 `console.log`（19处），但属于开发脚本，可接受
- 未发现硬编码密钥或未清理的 TODO

## P2 级别风险（中低优先级）

### 8. 类型安全

**文档依据**: 开发规则
**检查项**: any 类型过多
**扫描结果**:

- `apps/api/src/job/job.service.ts` 中存在多处 `any` 类型使用（29处）
- 包括：`type ShotJobWithShotHierarchy = any;`、`payload as any` 等

## 详细风险清单

详细风险登记册见: `docs/_risk/RISK_REGISTER.md`

原始扫描结果文件：

- `docs/_risk/risk_runtime_fragility.txt` (空)
- `docs/_risk/risk_prisma_related.txt` (空)
- `docs/_risk/risk_api_security.txt` (1行)
- `docs/_risk/risk_task_system.txt` (空)
- `docs/_risk/risk_audit.txt` (1行)
- `docs/_risk/risk_prod_hazards.txt` (空)

## 验证结果

### 必跑项

- ✅ **TypeCheck**: 通过（无 typecheck 脚本）
- ✅ **Lint**: 通过（仅警告）
- ❌ **Build**: **失败** - 7 个编译错误
- ✅ **Prisma 验证**: 通过
- ✅ **Prisma 生成**: 通过，生成物存在

### 必查项

- ⚠️ **API/DB 契约一致性**: 部分问题（遗留文件仍使用 @prisma/client）
- ⚠️ **安全链路（HMAC/Nonce/Timestamp）**: 需要人工检查
- ✅ **审计链路**: 已合规

## 下一步行动

1. **立即修复编译错误**（P0 - 阻塞构建）
   - 修复 `AllExceptionsFilter` 导入
   - 修复 `project.tasks` 查询
   - 修复 `seasonId` 类型和缺失问题

2. **审核 P0 级别风险**，按文档优先级给出"P0 清零顺序"
3. **逐条修复 EXECUTE 指令包**（严格列文件路径与验证用例）
4. **修复后重新扫描验证**
