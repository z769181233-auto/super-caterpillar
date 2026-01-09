# 全量上线执行计划（Full Launch Execution Plan）

**生成日期**: 2025-12-18  
**状态**: 📋 **规划阶段**  
**模式**: PLAN → EXECUTE → REVIEW

---

## 一、计划说明

本计划按 Stage 拆解执行任务，每个任务包包含：

- ✅ 文件清单
- ✅ 回滚方案
- ✅ **自动化验证**（脚本清单、执行命令、结果摘要、日志路径）
- ✅ **人工验证**（Checklist 引用、关键检查项、执行人、结论）
- ✅ **Close 判定方式**（必要条件、禁止条件、Conditional Close 规则）

**执行规则：**

- 严格按照 Stage 1 → Stage 2 → Stage 3 → Stage 4 顺序执行
- Stage N 未 Close → 禁止进入 Stage N+1
- 每个任务包执行前必须经过用户确认

**验证要求（强制执行）：**

- ✅ 每个任务包必须包含完整的自动化验证脚本清单
- ✅ 每个任务包必须包含完整的人工验证 Checklist 引用
- ✅ 每个任务包必须明确 Close 判定方式（不允许 Conditional Close 的必须标注理由）
- ✅ 未满足"自动化 + 人工验证"的，一律 NOT CLOSE

---

## 二、Stage 1: 平台与安全基座

### 2.1 任务包：S1-TASK-001 - DB Schema 对齐（P0 修复）

#### 文件清单

**需要修改的文件：**

- `packages/database/prisma/schema.prisma` - 添加 `Asset` 表缺失字段
- `apps/api/src/storage/storage.service.ts` - 实现 `signed_url` 生成逻辑
- `apps/api/src/storage/storage.service.ts` - 实现 `hls_playlist_url` 生成逻辑
- `apps/api/src/storage/storage.service.ts` - 实现 `watermark_mode` 枚举逻辑
- `apps/api/src/storage/storage.service.ts` - 实现 `fingerprint_id` 关联逻辑

**需要新增的文件：**

- `packages/database/prisma/migrations/YYYYMMDDHHMMSS_add_asset_security_fields/migration.sql` - 数据库迁移脚本

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **数据库回滚**: `npx prisma migrate resolve --rolled-back <migration-name>`
3. **验证回滚**: 运行 `bash tools/gate/run_launch_gates.sh` 确认回滚成功

#### 自动化验证

**脚本清单：**

1. **Schema 验证**: `npx prisma validate`
2. **Migration 验证**: `npx prisma migrate status`
3. **门禁验证**: `bash tools/gate/run_launch_gates.sh` (Gate 1-5)
4. **约束验证**: [自定义脚本 - 验证外键/约束/默认值]

**执行命令：**

```bash
# 1. Schema 验证
npx prisma validate

# 2. Migration 验证
npx prisma migrate status

# 3. 门禁验证
bash tools/gate/run_launch_gates.sh

# 4. 生成报告
# 输出: docs/_evidence/automation_verification_S1_TASK_001_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S1_TASK_001_YYYYMMDD_HHMMSS.md`

**预期结果**: 所有验证 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 1 - DB Schema 对齐检查

**关键检查项：**

- [ ] `Asset` 表包含 `signed_url` 字段
- [ ] `Asset` 表包含 `hls_playlist_url` 字段
- [ ] `Asset` 表包含 `watermark_mode` 字段
- [ ] `Asset` 表包含 `fingerprint_id` 字段
- [ ] 所有字段类型符合 DBSpec V1.1
- [ ] 数据库迁移脚本正确执行
- [ ] 回滚脚本已验证可用

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ❌ **不允许**（P0 风险）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### 2.2 任务包：S1-TASK-002 - HMAC Auth 链路修复（P0 修复）

#### 文件清单

**需要修改的文件：**

- `apps/api/src/auth/hmac/timestamp-nonce.guard.ts` - 修复 `request.hmac` 读取问题
- `apps/api/src/auth/hmac/hmac-auth.guard.ts` - 确保正确设置请求属性

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 运行 `bash tools/gate/run_launch_gates.sh` (Gate 3) 确认回滚成功

#### 自动化验证

**脚本清单：**

1. **HMAC 验证测试**: `bash tools/gate/run_launch_gates.sh` (Gate 3)
2. **Nonce 防重放测试**: [自定义测试脚本]
3. **Timestamp 校验测试**: [自定义测试脚本]

**执行命令：**

```bash
# 1. HMAC 验证测试
bash tools/gate/run_launch_gates.sh  # Gate 3

# 2. Nonce 防重放测试
# [自定义测试脚本]

# 3. 生成报告
# 输出: docs/_evidence/automation_verification_S1_TASK_002_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S1_TASK_002_YYYYMMDD_HHMMSS.md`

**预期结果**: Gate 3 PASS，Nonce 测试 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 1 - HMAC Auth 链路完整性检查

**关键检查项：**

- [ ] `TimestampNonceGuard` 能正确读取 `request.hmacNonce`
- [ ] `TimestampNonceGuard` 能正确读取 `request.hmacTimestamp`
- [ ] Nonce 防重放机制正常工作
- [ ] Timestamp 校验正常工作
- [ ] 安全链路完整无断点

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ❌ **不允许**（P0 风险）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### 2.3 任务包：S1-TASK-003 - Schema 层级对齐（P1 修复）

#### 文件清单

**需要修改的文件：**

- `packages/database/prisma/schema.prisma` - 修复 `NovelChapter` 关联
- `packages/database/prisma/schema.prisma` - 修复 `Scene.project_id` 必填约束
- `packages/database/prisma/migrations/YYYYMMDDHHMMSS_fix_schema_hierarchy/migration.sql` - 数据库迁移脚本

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **数据库回滚**: `npx prisma migrate resolve --rolled-back <migration-name>`

#### 自动化验证

```bash
# 1. Schema 验证
npx prisma validate

# 2. Migration 验证
npx prisma migrate status

# 3. 约束验证
# [自定义测试脚本]

# 4. 生成报告
# 输出: docs/_evidence/automation_verification_S1_TASK_003_YYYYMMDD_HHMMSS.md
```

**预期结果**: 所有验证 PASS

#### 人工验证

使用模板: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**关键检查项：**

- [ ] `NovelChapter` 关联至 `NovelVolume`（而非 `NovelSource`）
- [ ] `Scene.project_id` 为必填字段
- [ ] 数据库约束正确生效

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 条件**:

- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（GAP-S1-DB-005 ~ GAP-S1-DB-006 标记为已修复）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

---

### Stage 1 总体 Close 判定

**Close 条件**:

- ✅ 所有 P0 任务包（S1-TASK-001, S1-TASK-002）已 Close
- ✅ 所有 P1 任务包（S1-TASK-003）已 Close
- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（Stage 1 部分标记为 CLOSE）

**判定**: ✅ **Stage 1 CLOSE** / ❌ **Stage 1 NOT CLOSE**

---

## 三、Stage 2: 任务调度与生产管线

### 3.1 任务包：S2-TASK-001 - Stage 2 验证与确认

#### 文件清单

**需要验证的文件：**

- `apps/api/src/engine/engine-registry-hub.service.ts`
- `apps/api/src/engine/engine-invoker-hub.service.ts`
- `apps/api/src/orchestrator/orchestrator.service.ts`
- `apps/workers/src/worker-agent.service.ts`

#### 回滚方案

**无需回滚**（仅验证，不修改代码）

#### 自动化验证

```bash
# 1. Engine Hub 验证
bash tools/smoke/run_video_e2e.sh

# 2. Orchestrator 验证
# [自定义测试脚本]

# 3. Worker 验证
# [自定义测试脚本]

# 4. 生成报告
# 输出: docs/_evidence/automation_verification_S2_TASK_001_YYYYMMDD_HHMMSS.md
```

**预期结果**: 所有验证 PASS

#### 人工验证

使用模板: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**关键检查项：**

- [ ] Engine Hub 核心架构完整实现
- [ ] Orchestrator 调度逻辑完整实现
- [ ] Worker 节点注册与心跳机制完整
- [ ] 任务重试与超时机制完整

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 条件**:

- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（Stage 2 部分标记为 CLOSE）

**判定**: ✅ **Stage 2 CLOSE** / ❌ **Stage 2 NOT CLOSE**

---

## 四、Stage 3: AI 引擎体系

### 4.1 任务包：S3-TASK-001 - 语义分析能力实现（P0 修复）

**预估时间**: 1-2 天

#### 文件清单

**需要修改的文件：**

- `apps/workers/src/novel-analysis-processor.ts` - 集成语义分析能力

**需要新增的文件：**

- `apps/workers/src/engines/semantic-analyzer.ts` - 语义分析引擎

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 回退到 Import Stub 模式（需在代码中标记）

#### 自动化验证

**脚本清单：**

1. **语义分析能力测试**: [自定义测试脚本 - 验证摘要、关键词、角色、情绪、节奏]
2. **小说导入 E2E 测试**: `bash tools/smoke/run_video_e2e.sh`

**执行命令：**

```bash
# 1. 语义分析能力测试
# [自定义测试脚本]

# 2. 小说导入 E2E 测试
bash tools/smoke/run_video_e2e.sh

# 3. 生成报告
# 输出: docs/_evidence/automation_verification_S3_TASK_001_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S3_TASK_001_YYYYMMDD_HHMMSS.md`

**预期结果**: 所有验证 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 3 - 语义分析能力检查

**关键检查项：**

- [ ] 语义分析能力完整实现（摘要、关键词、角色、情绪、节奏）
- [ ] 语义分析结果正确写入数据库

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ❌ **不允许**（P0 风险）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### 4.2 任务包：S3-TASK-002 - 分镜能力实现（P0 修复）

**预估时间**: 1-2 天

#### 文件清单

**需要修改的文件：**

- `apps/workers/src/novel-analysis-processor.ts` - 集成分镜能力

**需要新增的文件：**

- `apps/workers/src/engines/storyboard-generator.ts` - 分镜生成引擎

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 回退到 Import Stub 模式（需在代码中标记）

#### 自动化验证

**脚本清单：**

1. **分镜能力测试**: [自定义测试脚本 - 验证镜头类型、运动方式、构图建议]
2. **小说导入 E2E 测试**: `bash tools/smoke/run_video_e2e.sh`

**执行命令：**

```bash
# 1. 分镜能力测试
# [自定义测试脚本]

# 2. 小说导入 E2E 测试
bash tools/smoke/run_video_e2e.sh

# 3. 生成报告
# 输出: docs/_evidence/automation_verification_S3_TASK_002_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S3_TASK_002_YYYYMMDD_HHMMSS.md`

**预期结果**: 所有验证 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 3 - 分镜能力检查

**关键检查项：**

- [ ] 分镜能力完整实现（镜头类型、运动方式、构图建议）
- [ ] 分镜结果正确写入数据库

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ❌ **不允许**（P0 风险）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### 4.3 任务包：S3-TASK-003 - 导演能力实现（P0 修复）

**预估时间**: 1-2 天

#### 文件清单

**需要修改的文件：**

- `apps/workers/src/novel-analysis-processor.ts` - 集成导演能力

**需要新增的文件：**

- `apps/workers/src/engines/director-assistant.ts` - 导演辅助引擎

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 回退到 Import Stub 模式（需在代码中标记）

#### 自动化验证

**脚本清单：**

1. **导演能力测试**: [自定义测试脚本 - 验证场景调度、节奏控制]
2. **小说导入 E2E 测试**: `bash tools/smoke/run_video_e2e.sh`

**执行命令：**

```bash
# 1. 导演能力测试
# [自定义测试脚本]

# 2. 小说导入 E2E 测试
bash tools/smoke/run_video_e2e.sh

# 3. 生成报告
# 输出: docs/_evidence/automation_verification_S3_TASK_003_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S3_TASK_003_YYYYMMDD_HHMMSS.md`

**预期结果**: 所有验证 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 3 - 导演能力检查

**关键检查项：**

- [ ] 导演能力完整实现（场景调度、节奏控制）
- [ ] 导演结果正确写入数据库

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ❌ **不允许**（P0 风险）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### 4.4 任务包：S3-TASK-004 - 补全能力实现（P0 修复）

**预估时间**: 1-2 天

#### 文件清单

**需要修改的文件：**

- `apps/workers/src/novel-analysis-processor.ts` - 集成补全能力

**需要新增的文件：**

- `apps/workers/src/engines/content-completer.ts` - 内容补全引擎

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 回退到 Import Stub 模式（需在代码中标记）

#### 自动化验证

**脚本清单：**

1. **补全能力测试**: [自定义测试脚本 - 验证内容补全、结构优化]
2. **小说导入 E2E 测试**: `bash tools/smoke/run_video_e2e.sh`

**执行命令：**

```bash
# 1. 补全能力测试
# [自定义测试脚本]

# 2. 小说导入 E2E 测试
bash tools/smoke/run_video_e2e.sh

# 3. 生成报告
# 输出: docs/_evidence/automation_verification_S3_TASK_004_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S3_TASK_004_YYYYMMDD_HHMMSS.md`

**预期结果**: 所有验证 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 3 - 补全能力检查

**关键检查项：**

- [ ] 补全能力完整实现（内容补全、结构优化）
- [ ] 补全结果正确写入数据库
- [ ] 代码注释更新（移除"仅为 Import Stub"的认定）

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）
- ✅ 差距报告更新（GAP-S3-CE06-001 ~ GAP-S3-CE06-004 标记为已修复）
- ✅ 代码注释更新（移除"仅为 Import Stub"的认定）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ❌ **不允许**（P0 风险）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### 4.5 任务包：S3-TASK-005 - Studio 前端编辑功能完善（P1 修复）

**预估时间**: 2-3 天

---

#### 文件清单

**需要修改的文件：**

- `apps/web/src/components/project/ProjectStructureTree.tsx` - 实现结构树编辑功能
- `apps/web/src/app/[locale]/projects/[projectId]/page.tsx` - 集成编辑功能

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 回退到只读模式

#### 自动化验证

**脚本清单：**

1. **前端 E2E 测试**: `pnpm --filter web test:e2e`
2. **结构树编辑功能测试**: [自定义测试脚本]

**执行命令：**

```bash
# 1. 前端 E2E 测试
pnpm --filter web test:e2e

# 2. 结构树编辑功能测试
# [自定义测试脚本]

# 3. 生成报告
# 输出: docs/_evidence/automation_verification_S3_TASK_005_YYYYMMDD_HHMMSS.md
```

**结果摘要要求**:

- ✅ 所有脚本 PASS
- ✅ 日志路径: `docs/_evidence/automation_verification_S3_TASK_005_YYYYMMDD_HHMMSS.md`

**预期结果**: 所有验证 PASS

#### 人工验证

**使用模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**Checklist 引用**: Stage 3 - Studio 前端编辑功能检查

**关键检查项：**

- [ ] 结构树编辑功能完整实现
- [ ] 编辑操作能正确保存到数据库
- [ ] 编辑操作有适当的权限控制

**执行人**: [待填写]
**执行时间**: [待填写]
**结论**: PASS / FAIL / CONDITIONAL PASS

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 的必要条件**:

- ✅ 自动化验证全部 PASS（所有脚本 PASS，报告已生成）
- ✅ 人工验证全部 PASS（所有 Checklist 项 PASS，执行人已签名）
- ✅ Close Decision 已明确（CLOSE / NOT CLOSE）
- ✅ 差距报告更新（GAP-S3-UI-002 标记为已修复）

**Close 的禁止条件**:

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录

**Conditional Close**: ⚠️ **条件允许**（P1 风险，需书面说明）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

**是否允许进入下一 Stage**: ✅ 是 / ❌ 否

**是否需要回滚或补丁**: ✅ 是 / ❌ 否

---

### Stage 3 总体 Close 判定

**Close 条件**:

- ✅ 所有 P0 任务包（S3-TASK-001, S3-TASK-002, S3-TASK-003, S3-TASK-004）已 Close
- ✅ 所有 P1 任务包（S3-TASK-005）已 Close
- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（Stage 3 部分标记为 CLOSE）
- ✅ 代码注释更新（移除"仅为 Import Stub"的认定）

**判定**: ✅ **Stage 3 CLOSE** / ❌ **Stage 3 NOT CLOSE**

---

## 五、Stage 4: 质量、安全、自动修复与发布治理

### 5.1 任务包：S4-TASK-001 - 质量门禁系统实现（P0 修复）

**预估时间**: 3 天

#### 文件清单

**需要新增的文件：**

- `apps/api/src/quality/quality-gate.service.ts` - 质量门禁服务
- `apps/api/src/quality/quality-gate.controller.ts` - 质量门禁控制器
- `apps/api/src/quality/quality-gate.module.ts` - 质量门禁模块

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 禁用质量门禁（通过 feature flag）

#### 自动化验证

```bash
# 1. 质量门禁测试
# [自定义测试脚本]

# 2. 生成报告
# 输出: docs/_evidence/automation_verification_S4_TASK_001_YYYYMMDD_HHMMSS.md
```

**预期结果**: 所有验证 PASS

#### 人工验证

使用模板: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**关键检查项：**

- [ ] 质量门禁系统完整实现
- [ ] 质量门禁能正确拦截不合格内容
- [ ] 质量门禁有适当的告警机制

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 条件**:

- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（GAP-S4-QA-001 标记为已修复）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

---

### 5.2 任务包：S4-TASK-002 - 自动修复机制实现（P0 修复）

**预估时间**: 3 天

#### 文件清单

**需要新增的文件：**

- `apps/api/src/repair/auto-repair.service.ts` - 自动修复服务
- `apps/api/src/repair/auto-repair.controller.ts` - 自动修复控制器
- `apps/api/src/repair/auto-repair.module.ts` - 自动修复模块

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 禁用自动修复（通过 feature flag）

#### 自动化验证

```bash
# 1. 自动修复测试
# [自定义测试脚本]

# 2. 生成报告
# 输出: docs/_evidence/automation_verification_S4_TASK_002_YYYYMMDD_HHMMSS.md
```

**预期结果**: 所有验证 PASS

#### 人工验证

使用模板: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**关键检查项：**

- [ ] 自动修复机制完整实现
- [ ] 自动修复能正确修复常见问题
- [ ] 自动修复有适当的日志和审计

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 条件**:

- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（GAP-S4-QA-002 标记为已修复）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

---

### 5.3 任务包：S4-TASK-003 - 发布治理流程实现（P0 修复）

**预估时间**: 2-3 天

#### 文件清单

**需要新增的文件：**

- `apps/api/src/governance/release-governance.service.ts` - 发布治理服务
- `apps/api/src/governance/release-governance.controller.ts` - 发布治理控制器
- `apps/api/src/governance/release-governance.module.ts` - 发布治理模块

#### 回滚方案

1. **代码回滚**: `git revert <commit-hash>`
2. **功能回滚**: 禁用发布治理（通过 feature flag）

#### 自动化验证

```bash
# 1. 发布治理测试
# [自定义测试脚本]

# 2. 生成报告
# 输出: docs/_evidence/automation_verification_S4_TASK_003_YYYYMMDD_HHMMSS.md
```

**预期结果**: 所有验证 PASS

#### 人工验证

使用模板: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

**关键检查项：**

- [ ] 发布治理流程完整实现
- [ ] 发布治理能正确控制发布流程
- [ ] 发布治理有适当的审批机制

**预期结果**: 所有检查项 PASS

#### Close 判定方式

**Close 条件**:

- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（GAP-S4-QA-003 标记为已修复）

**判定**: ✅ CLOSE / ❌ NOT CLOSE

---

### Stage 4 总体 Close 判定

**Close 条件**:

- ✅ 所有 P0 任务包（S4-TASK-001, S4-TASK-002, S4-TASK-003）已 Close
- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS
- ✅ 差距报告更新（Stage 4 部分标记为 CLOSE）

**判定**: ✅ **Stage 4 CLOSE** / ❌ **Stage 4 NOT CLOSE**

---

## 六、全量上线总体 Close 判定

**Close 条件**:

- ✅ Stage 1 CLOSE
- ✅ Stage 2 CLOSE
- ✅ Stage 3 CLOSE
- ✅ Stage 4 CLOSE
- ✅ 所有自动化验证全部 PASS
- ✅ 所有人工验证全部 PASS
- ✅ 差距报告全部标记为已修复

**判定**: ✅ **全量上线 CLOSE** / ❌ **全量上线 NOT CLOSE**

---

## 七、执行时间线（预估）

| Stage   | 任务包      | 预估时间 | 状态      |
| :------ | :---------- | :------: | :-------- |
| Stage 1 | S1-TASK-001 |  2-3 天  | 📋 待执行 |
| Stage 1 | S1-TASK-002 |  1-2 天  | 📋 待执行 |
| Stage 1 | S1-TASK-003 |  1-2 天  | 📋 待执行 |
| Stage 2 | S2-TASK-001 |   1 天   | 📋 待执行 |
| Stage 3 | S3-TASK-001 |  1-2 天  | 📋 待执行 |
| Stage 3 | S3-TASK-002 |  1-2 天  | 📋 待执行 |
| Stage 3 | S3-TASK-003 |  1-2 天  | 📋 待执行 |
| Stage 3 | S3-TASK-004 |  1-2 天  | 📋 待执行 |
| Stage 3 | S3-TASK-005 |  2-3 天  | 📋 待执行 |
| Stage 4 | S4-TASK-001 |   3 天   | 📋 待执行 |
| Stage 4 | S4-TASK-002 |   3 天   | 📋 待执行 |
| Stage 4 | S4-TASK-003 |  2-3 天  | 📋 待执行 |

**总计预估时间**: 19-28 天

**注意**: 所有任务包均 ≤ 3 天，符合要求。

---

## 八、计划更新记录

| 日期       | 更新内容     | 更新人 |
| :--------- | :----------- | :----- |
| 2025-12-18 | 初始计划创建 | Cursor |

---

**计划维护**: 每次任务包执行或 Stage Close 后必须更新本计划。
