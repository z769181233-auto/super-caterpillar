# Stage9-3 · Jobs / Tasks UI 优化自测报告

**测试时间**: 2025-12-13  
**测试范围**: Jobs / Tasks 列表 UI 优化  
**测试人员**: AI Assistant (Cursor)

---

## 一、测试页面

### 1. Jobs 列表页面

- **路径**: `/studio/jobs`
- **功能**: Jobs 列表展示、筛选、详情查看

### 2. Tasks 关系图页面

- **路径**: `/tasks/[taskId]/graph`
- **功能**: Task 关系图展示（本次未修改，仅作为参考）

---

## 二、修改文件

### 新增组件（3个）

1. `apps/web/src/components/ui/PanelShell.tsx` - 统一面板容器组件
2. `apps/web/src/components/ui/StatusBadge.tsx` - 统一状态展示组件
3. `apps/web/src/components/ui/DetailDrawer.tsx` - 统一详情抽屉组件

### 修改页面（1个）

4. `apps/web/src/app/studio/jobs/page.tsx` - Jobs 列表页面

---

## 三、交互点测试

### 1. 状态展示

- ✅ 状态统一使用 StatusBadge 组件（dot + label）
- ✅ RUNNING 状态有 pulse 动画
- ✅ 状态颜色与原有逻辑一致

### 2. 详情抽屉

- ✅ 点击 Job 行打开详情抽屉
- ✅ 详情抽屉信息结构按顺序展示：
  - Header：标题 + 状态（dot）+ id（可复制）
  - Timeline：createdAt / startedAt / finishedAt
  - Input：JSON 折叠块（默认折叠）
  - Output：JSON 折叠块（默认折叠）
  - Errors：如果有 error 字段，红色块突出（可复制）
  - Actions：Retry / Cancel（沿用现有调用）
- ✅ 关闭抽屉功能正常

### 3. Loading/Empty/Error 状态

- ✅ Loading：spinner + "加载中..."
- ✅ Empty：图标 + "暂无数据"
- ✅ Error：红色 panel + message（与 Studio 三面板一致）

### 4. 筛选/搜索/排序

- ✅ 筛选功能正常（状态、类型、处理器等）
- ✅ 分组查看功能正常（按 Engine / Version）
- ✅ 排序功能正常（最新优先）

---

## 四、功能零变化声明

**未影响** ✅

**详细说明**:

- ✅ **不改 props**: 所有组件 props 语义保持不变
- ✅ **不改 API**: API 调用方式保持不变（`jobApi.listJobs`, `jobApi.getJobById`, `jobApi.retryJob`, `jobApi.cancelJob` 等）
- ✅ **不改数据结构**: Jobs/Tasks 数据结构保持不变
- ✅ **不改状态字段**: 状态字段名/含义保持不变（PENDING/RUNNING/SUCCEEDED/FAILED 等）
- ✅ **不改操作按钮行为**: Retry/Cancel/Refresh 等操作按钮行为保持不变（沿用现有调用，不改逻辑）
- ✅ **仅 UI 变更**: 仅修改了 UI 展示方式，未改动任何业务逻辑

**UI 变更范围**:

- 统一状态展示：使用 StatusBadge 组件（dot + label + pulse）
- 统一详情抽屉：使用 DetailDrawer 组件（按顺序展示信息）
- 统一 Loading/Empty/Error 状态：与 Studio 三面板一致
- 优化列表布局：保持表格布局，但状态展示更统一

---

## 五、UI 改动说明

### 1. 统一状态展示（StatusBadge）

- **变更**: 从内联样式改为 StatusBadge 组件
- **效果**: dot + label +（RUNNING 有 pulse）
- **位置**: Jobs 列表表格中的状态列

### 2. 统一详情抽屉（DetailDrawer）

- **变更**: 从右侧固定面板改为抽屉组件
- **效果**: 按顺序展示信息（Header → Timeline → Input → Output → Errors → Actions）
- **位置**: 点击 Job 行时打开

### 3. 统一 Loading/Empty/Error 状态

- **变更**: 从简单文本改为统一视觉体系
- **效果**: 与 Studio 三面板一致（spinner + 文案、图标 + 文案、红色 panel + message）
- **位置**: Jobs 列表加载/空/错误状态

---

## 六、已知问题

无

---

## 七、结论

✅ **功能零变化，UI 优化完成**

- 所有操作按钮行为保持不变
- 所有 API 调用保持不变
- 所有数据结构保持不变
- 仅 UI 展示方式优化，提升可扫读性和可追溯性

---

**报告生成时间**: 2025-12-13  
**报告状态**: 完成
