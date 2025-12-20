# Stage9 · UI/UX 优化专明确阶段（与功能彻底解耦）

**执行时间**: 2025-12-13  
**模式**: EXECUTE → UI OPTIMIZATION  
**状态**: 🔓 已解锁  
**是否允许回滚**: ❌ 不允许（UI 优化必须保持）

---

## 一、Stage9 总体硬约束（强制规则）

### ❌ 禁止事项

1. **禁止新增功能**
2. **禁止修改 API / Worker / Job / Guard / Script**
3. **禁止修改数据库 / Prisma / Schema**
4. **禁止改动 Stage5–Stage8 的任何 CI Guard**

### ✅ 只允许修改

1. **UI 组件** (`apps/web/src/components/**`)
2. **页面布局** (`apps/web/src/app/**`)
3. **样式 / 交互 / 视觉层** (`apps/web/src/styles/**`)

### ✅ 所有改动必须

- **不影响现有测试报告与 CI 通过结果**
- **功能行为零变化**

---

## 二、Stage9 执行步骤

### Step 1: 建立 UI 影响范围清单（只读）✅

**文件**: `docs/STAGE9_UI_SCOPE.md`

**内容**:
- 前端页面列表 (`apps/web/src/app`)
- 前端组件列表 (`apps/web/src/components`)
- 样式文件列表 (`apps/web/src/styles`)
- UI 优化允许/禁止范围说明

**状态**: ✅ 已完成

### Step 2: 冻结功能接口（防 UI 误伤）✅

**验证命令**:
```bash
pnpm --filter api build
pnpm -w lint
```

**要求**: 结果必须全 PASS，作为 UI 优化的"基线快照"

**状态**: ✅ 已验证

### Step 3: 开始 UI / UX 优化（唯一允许的修改）

**允许修改范围**:
- `apps/web/src/app/**`
- `apps/web/src/components/**`
- `apps/web/src/styles/**`

**允许做的事**:
- ✅ 布局重排
- ✅ 视觉优化
- ✅ 文案优化
- ✅ 交互细节（hover / loading / empty state）

**禁止做的事**:
- ❌ 改接口
- ❌ 改 props 语义
- ❌ 改状态流转
- ❌ 加新功能按钮

**状态**: 🔄 待执行

### Step 4: UI 自测（强制，但不要求测试报告）

**Stage9 的测试规则**（与 Stage8 不同）:
- ✅ 需要人工 UI 自测
- ❌ 不要求新增 TEST_REPORT
- ❌ 不允许复用功能测试报告

**提交说明要求**:
- 测了哪些页面
- 是否影响现有行为（必须写"未影响"）

**状态**: 🔄 待执行

### Step 5: 最终回归验证（必须）

**功能与架构回归**:
```bash
bash tools/ci/check-prisma-single-source.sh
bash tools/ci/check-nonce-fallback.sh
bash tools/ci/check-test-report-exists.sh
bash tools/ci/check-test-report-naming.sh
bash tools/ci/check-test-report-fresh.sh
```

**构建验证**:
```bash
pnpm --filter api build
```

**要求**: 任何失败 → UI 改动不允许合并

**状态**: 🔄 待执行

---

## 三、Stage9 完成判定条件

Stage9 只有在以下全部满足时才算完成：

- ✅ 所有 UI 改动不触发任何 CI Guard
- ✅ Stage5–Stage8 的所有测试报告仍然有效
- ✅ 功能行为零变化
- ✅ UI 自测说明完整
- ✅ 未引入任何"顺手优化"

---

## 四、为什么 UI 必须在 Stage9 才做

**Stage5–8 解决的是**: "系统是否可信" ✅

**Stage9 才解决**: "系统是否好用" 🔓

**当前时间点**:
- 功能：稳定 ✅
- 测试：强约束 ✅
- CI：自动防回退 ✅

👉 **这是做 UI 的最佳、也是唯一正确的窗口**

---

## 五、UI 优化方向建议

### 优先级 1: Studio 页面
- 项目结构树展示优化
- Scene/Shot 详情面板布局
- 语义信息、镜头规划、质量提示面板的视觉优化

### 优先级 2: Jobs 页面
- 任务列表布局优化
- 状态展示（loading / success / error）视觉优化
- 空状态提示优化

### 优先级 3: Project 页面
- 项目概览布局优化
- 导航交互优化
- 响应式布局优化

---

**报告生成时间**: 2025-12-13  
**报告状态**: 执行中  
**是否允许回滚**: ❌ **不允许**

