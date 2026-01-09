# 风险登记册 (RISK_REGISTER)

生成时间: 2024-12-13
Git Commit: $(cat docs/\_risk/\_git_commit.txt 2>/dev/null || echo "N/A")

## 风险分级说明

- **P0**: 必须立即修复，否则违反核心安全/审计/契约要求
- **P1**: 高优先级，影响系统稳定性或可维护性
- **P2**: 中低优先级，建议修复但非阻塞

---

| RiskId | P级别 | 文档条款             | 文件:行号                                                  | 命中片段                                            | 风险说明                                           | 建议验证用例                                                    |
| ------ | ----- | -------------------- | ---------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| R001   | P0    | API Spec V1.1 第11章 | apps/api/src/novel-import/novel-import.controller.ts:50,74 | process.cwd()                                       | 运行时脆弱点：使用 process.cwd() 动态路径          | 检查是否使用环境变量或配置固定路径                              |
| R002   | P0    | API Spec V1.1 第11章 | 待人工检查                                                 | HMAC/Nonce/Timestamp 缺失                           | 敏感/高成本接口未启用 HMAC/Nonce/Timestamp、防重放 | 检查所有 POST/PUT/DELETE 接口是否使用 @UseGuards(HmacAuthGuard) |
| R003   | P0    | TaskSys Spec         | apps/api/src/job/job.service.ts:101,239,375                | maxRetry: 3                                         | ✅ 任务重试已控制：maxRetry ≤ 3                    | 验证所有 Job 创建时 maxRetry 是否 ≤ 3                           |
| R004   | P0    | SafetySpec           | apps/api/src/job/job.service.ts:247,384,598                | auditLogService.record                              | ✅ 审计链路存在：关键操作写入 audit_logs           | 检查关键操作是否写入 audit_logs，是否包含 trace_id              |
| R005   | P0    | SafetySpec           | apps/api/src/job/job.service.ts:276,286                    | traceId                                             | ✅ trace_id 链路存在：从 Task 获取 traceId         | 检查 trace_id 是否在所有关键操作中传递                          |
| R006   | P0    | 开发规则             | 无                                                         | @prisma/client 直接导入                             | ✅ 已修复：所有 Prisma 导入从 'database' 包导入    | 验证无 @prisma/client 直接导入                                  |
| R007   | P1    | 开发规则             | apps/api/src/prisma/prisma.service.ts:14                   | require.resolve('database')                         | 运行时脆弱点：使用 require.resolve                 | 检查是否可以改为静态导入                                        |
| R008   | P1    | 开发规则             | apps/api/src/scripts/\*.ts                                 | console.log                                         | 生产危险：脚本中存在调试输出                       | 检查生产代码中是否有调试输出                                    |
| R009   | P2    | 开发规则             | apps/api/src/job/job.service.ts:26,129-133,507,621,824     | type ShotJobWithShotHierarchy = any; payload as any | 类型安全：any 类型过多                             | 检查是否有过多 any 类型使用                                     |
| R010   | P0    | 开发规则             | apps/api/src/project/project.service.ts:223-249            | project.tasks 不存在                                | 编译错误：查询时未 include tasks                   | 在 getProjectTree 的 findUnique 中添加 tasks include            |
| R011   | P0    | 开发规则             | apps/api/src/project/project.service.ts:431                | seasonId 缺失                                       | 编译错误：Episode 创建时缺少 seasonId              | 修复 Episode 创建逻辑，确保 seasonId 正确传递                   |

---

## 详细扫描结果

### 编译错误（P0 - 阻塞构建）

1. **apps/api/src/project/project.service.ts:223-249** - `project.tasks` 不存在
   - 问题：查询时未 include `tasks`
   - 修复：在 `getProjectTree` 的 `findUnique` 中添加 `tasks: { select: { ... } }`

2. **apps/api/src/project/project.service.ts:431** - `seasonId` 缺失
   - 问题：Episode 创建时缺少必需的 `seasonId` 字段
   - 修复：确保 Episode 创建时正确传递 `seasonId`

### API 安全链路（P0）

- 需要人工检查所有 POST/PUT/DELETE 接口是否使用 `@UseGuards(HmacAuthGuard)`
- 扫描结果：见 `risk_api_security.txt`

### 任务系统（P0 - 已合规）

- ✅ 所有 Job 创建时 `maxRetry: 3`，符合要求

### 审计链路（P0 - 已合规）

- ✅ 关键操作使用 `auditLogService.record`
- ✅ `traceId` 从 Task 获取并传递

### 契约漂移（P0 - 已修复）

- ✅ 所有 Prisma 导入从 'database' 包导入

### 运行时脆弱点（P1）

- `apps/api/src/novel-import/novel-import.controller.ts:50,74` - 使用 `process.cwd()`
- `apps/api/src/prisma/prisma.service.ts:14` - 使用 `require.resolve`

### 生产危险（P1）

- 脚本中存在 `console.log`，但属于开发脚本，可接受

### 类型安全（P2）

- `apps/api/src/job/job.service.ts` 中存在多处 `any` 类型使用
