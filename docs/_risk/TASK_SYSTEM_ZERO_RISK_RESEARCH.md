# 任务系统"0雷区"修复 - RESEARCH 阶段报告

## 模式声明

**MODE: RESEARCH** - 确认基线 + 判定是否必须回滚

## 一、当前状态检查

### 1.1 工作区位置

- **当前目录**: `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar`
- **当前分支**: `chore/zero-risk-hardening-task-system`
- **分支状态**: 新分支，无提交历史

### 1.2 变更范围检查

**发现越界变更：**

- ❌ **health 模块**: `apps/api/src/health/` 目录存在未跟踪文件
  - `health.controller.ts`
  - `health.module.ts`
- ❌ **大量非任务系统文件**: `git diff --name-only` 显示 52 个文件变更，包含：
  - `apps/api/src/app.module.ts` (导入 HealthModule)
  - 多个 auth/audit/engine 相关文件
  - 非任务系统目录的修改

### 1.3 基线提交查找

**问题**: 当前分支无提交历史，无法直接查找基线

**解决方案**:

- 需要切换到主分支（main/master/develop）查找基线
- 或基于 `docs/_risk/TASK_SYSTEM_RULES_ACCEPTANCE.md` 文件的存在性判断基线

## 二、RESEARCH 判定结果

### 2.1 越界判定

**✅ 判定：必须回滚**

**理由**:

1. **新增了 health 模块**（违反 PLAN 禁止项）
2. **变更范围过大**（52 个文件，远超任务系统范围）
3. **包含非任务系统目录修改**（auth/audit/engine 等）

### 2.2 基线确定策略

由于当前分支无提交历史，需要：

1. 切换到主分支
2. 查找包含 `TASK_SYSTEM_RULES_ACCEPTANCE.md` 的提交作为基线
3. 或查找包含 `job.rules.ts` 和 `job.retry.ts` 的提交作为基线

## 三、下一步行动

### 3.1 必须执行的操作

1. **删除 health 模块**

   ```bash
   rm -rf apps/api/src/health/
   ```

2. **回滚到基线提交**
   - 切换到主分支
   - 找到基线提交
   - 创建新分支从基线开始

3. **重新执行最小修复**
   - 只修改 PLAN 列出的 8 个文件
   - 禁止新增任何模块

### 3.2 允许的变更文件清单（PLAN 要求）

1. `apps/api/src/job/job.rules.ts`
2. `apps/api/src/job/job.retry.ts`
3. `apps/api/src/job/job.service.ts`
4. `apps/api/src/orchestrator/orchestrator.service.ts`
5. `apps/api/src/worker/worker.service.ts`
6. `apps/api/src/job/job-worker.service.ts`
7. `packages/config/src/env.ts`
8. `docs/_risk/TASK_SYSTEM_ZERO_RISK_ACCEPTANCE.md`（文档）

## 四、本模式产出物

1. ✅ `docs/_risk/TASK_SYSTEM_ZERO_RISK_RESEARCH.md`（本文档）
2. ✅ 变更证据保存：`/tmp/DIFF_STAT_BEFORE_ROLLBACK.txt`
3. ✅ 判定结果：**必须回滚**

---

## 五、进入 PLAN 模式

基于 RESEARCH 结果，进入 PLAN 模式制定最小修复计划。
