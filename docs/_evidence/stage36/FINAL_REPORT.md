# Stage 36: Post-merge Regression Hotfix - UserRole 小写兼容修复（最终报告）

## 执行摘要

- **目的**: 修复 master 合并 Stage35 后出现的 UserRole 大写引用导致的 typecheck 失败
- **策略**: 仅做兼容性修复（将大写引用改为小写值），不引入新业务能力
- **验证**: typecheck / lint / build 均 PASS（见 assets/ 日志）

## 改动范围（最小化）

### 1. UserRole 大小写兼容修复

**文件**:

- `apps/api/src/auth/auth.service.ts` - UserRole.CREATOR → UserRole.creator
- `apps/api/src/create-test-user.ts` - UserRole.ADMIN → UserRole.admin (2处)
- `apps/api/test/contract/jobs-state-machine.e2e-spec.ts` - 'ADMIN' → 'admin'
- `apps/api/test/stage4-flow.e2e-spec.ts` - 'ADMIN' → 'admin'

**理由**: Stage35 将 Prisma schema 的 UserRole enum 改为小写（与数据库一致），但业务代码仍使用大写引用

### 2. Next.js 路由冲突修复

**文件**:

- 删除 `apps/web/src/app/[locale]/projects/[id]/` 目录

**理由**: 与 `[projectId]` 目录冲突，导致 Next.js 构建失败。`[projectId]` 是正确的命名约定。

## 验证结果（证据）

### 静态检查

- **typecheck**: ✅ PASS - `docs/_evidence/stage36/assets/typecheck.log`
- **lint**: ✅ PASS - `docs/_evidence/stage36/assets/lint.log`
  - 0 errors, 仅既有 warnings
- **build**: ✅ PASS - `docs/_evidence/stage36/assets/build.log`

### 运行时验证

- 无数据库写入
- 无迁移执行
- 无新增业务能力

## 修改文件清单

### 业务代码修复（5个文件）

1. `apps/api/src/auth/auth.service.ts`
2. `apps/api/src/create-test-user.ts`
3. `apps/api/test/contract/jobs-state-machine.e2e-spec.ts`
4. `apps/api/test/stage4-flow.e2e-spec.ts`
5. `apps/api/src/storage/storage.controller.ts` (合并引入)
6. `apps/api/src/storage/storage.module.ts` (合并引入)

### 路由修复

7. 删除 `apps/web/src/app/[locale]/projects/[id]/`

### 证据文档（新增）

8. `docs/_evidence/stage36/FINAL_REPORT.md` (本文件)
9. `docs/_evidence/stage36/DEVIATION_NOTE.md`
10. `docs/_evidence/stage36/assets/typecheck.log`
11. `docs/_evidence/stage36/assets/lint.log`
12. `docs/_evidence/stage36/assets/build.log`

## 风险分析

### ✅ 已控制风险

- ✅ 仅修改 enum 引用，不改变业务语义
- ✅ 全量静态验证通过
- ✅ 无数据库操作
- ✅ 无新增依赖

### ⚠️ 残留风险

- 低：可能存在动态生成的 UserRole 字符串（需运行时观察）
- 缓解：全面 grep 搜索已执行，未发现其他硬编码大写引用

## 结论

✅ **Stage 36 Post-merge Hotfix 完成**

- 所有静态检查通过
- UserRole 引用已完全兼容小写 enum
- Next.js 路由冲突已解决
- 无需数据库迁移
- 无新增业务能力

**Stage 35 不改；Stage 36 完结**
