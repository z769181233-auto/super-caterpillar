# Stage10 · UI Freeze Declaration（UI 冻结声明）

**冻结时间**: 2025-12-13  
**冻结范围**: Stage9 UI（Projects/Jobs/Studio 中间栏/右侧栏）  
**冻结人员**: AI Assistant (Cursor)

---

## 一、冻结范围

### Stage9-2: Projects 页面 UI
- **页面**: `/projects`
- **组件**: 
  - `apps/web/src/app/projects/page.tsx`
  - `apps/web/src/components/project/ProjectCard.tsx`
- **冻结内容**: Grid 卡片布局、空态设计、CTA 唯一、点击跳转逻辑

### Stage9-3: Jobs / Tasks 列表 UI
- **页面**: `/studio/jobs`, `/tasks/[taskId]/graph`
- **组件**: 
  - `apps/web/src/components/ui/PanelShell.tsx`
  - `apps/web/src/components/ui/StatusBadge.tsx`
  - `apps/web/src/components/ui/DetailDrawer.tsx`
  - `apps/web/src/app/studio/jobs/page.tsx`
- **冻结内容**: 统一 Loading/Empty/Error 视觉系统、统一状态展示、统一详情抽屉结构

### Stage9-4: Studio Command Center UI（中间栏 ContentList）
- **页面**: `/projects/[projectId]`（中间栏）
- **组件**: 
  - `apps/web/src/components/project/ContentList.tsx`
  - `apps/web/src/components/ui/ProgressCard.tsx`
- **冻结内容**: Episode/Scene ProgressCard 网格展示、Shot 列表增强、选中高亮/点击选择逻辑

### Stage9-5: Studio Right Panel Command Center UI
- **页面**: `/projects/[projectId]`（右侧栏）
- **组件**: 
  - `apps/web/src/components/studio/SemanticInfoPanel.tsx`
  - `apps/web/src/components/studio/ShotPlanningPanel.tsx`
  - `apps/web/src/components/studio/QualityHintPanel.tsx`
  - `apps/web/src/components/project/DetailPanel.tsx`
- **冻结内容**: 统一右侧 4 个面板的容器、Header、Body、Loading/Empty/Error 视觉语言

---

## 二、禁止改动清单

### 2.1 核心组件（严禁修改）
- ❌ **PanelShell.tsx**: 禁止修改 props 接口、禁止新增 props、禁止修改内部实现逻辑
- ❌ **StatusBadge.tsx**: 禁止修改 props 接口、禁止修改状态映射规则
- ❌ **DetailDrawer.tsx**: 禁止修改信息结构顺序（Header → Timeline → Input → Output → Errors → Actions）
- ❌ **ProgressCard.tsx**: 禁止修改 props 接口、禁止修改展示结构

### 2.2 业务组件（严禁修改）
- ❌ **ProjectCard.tsx**: 禁止修改卡片结构、禁止修改 CTA 逻辑
- ❌ **ContentList.tsx**: 禁止修改选中高亮/点击选择逻辑、禁止修改条件渲染逻辑
- ❌ **SemanticInfoPanel.tsx**: 禁止修改 props 接口、禁止修改 API 调用、禁止修改空态文案渲染位置（必须在 children 内）
- ❌ **ShotPlanningPanel.tsx**: 禁止修改 props 接口、禁止修改 API 调用、禁止修改空态文案渲染位置（必须在 children 内）
- ❌ **QualityHintPanel.tsx**: 禁止修改 props 接口、禁止修改 API 调用、禁止修改空态文案渲染位置（必须在 children 内）
- ❌ **DetailPanel.tsx**: 禁止修改底部固定区域结构、禁止修改分析状态展示逻辑、禁止修改跳转链接逻辑

### 2.3 页面层（严禁修改）
- ❌ **projects/page.tsx**: 禁止修改 Grid 布局、禁止修改空态设计、禁止修改 CTA 逻辑
- ❌ **projects/[projectId]/page.tsx**: 禁止修改三栏布局结构、禁止修改挂载顺序、禁止修改条件渲染逻辑
- ❌ **studio/jobs/page.tsx**: 禁止修改列表展示逻辑、禁止修改详情抽屉触发逻辑

### 2.4 后端/数据层（严禁修改）
- ❌ **apps/api/**: 禁止修改任何 API 接口
- ❌ **packages/database/**: 禁止修改数据库 Schema
- ❌ **packages/shared-types/**: 禁止修改共享类型定义
- ❌ **apps/web/src/lib/apiClient.ts**: 禁止修改 API 调用方法

### 2.5 业务逻辑（严禁修改）
- ❌ 禁止修改 props 语义
- ❌ 禁止修改 API 调用方式
- ❌ 禁止修改数据结构
- ❌ 禁止修改业务逻辑
- ❌ 禁止修改条件渲染逻辑
- ❌ 禁止修改挂载顺序
- ❌ 禁止修改路由逻辑
- ❌ 禁止修改 Guard 规则

---

## 三、允许改动清单（严格限制）

### 3.1 UI 样式微调（需附测试报告）
- ✅ **仅允许**: 纯 CSS/Tailwind 样式调整（颜色、间距、字体大小、圆角、阴影等）
- ✅ **前提条件**: 
  - 必须说明"为何必须修"（例如：修复视觉 bug、提升可访问性、响应式布局优化）
  - 必须生成对应的 `TEST_REPORT_STAGE10_UI_<FEATURE>_YYYYMMDD.md`
  - 必须通过全量回归验证（lint/build/Stage6/7/8 Guard）
  - 必须声明功能零变化

### 3.2 文档更新（无需测试报告）
- ✅ **允许**: 更新 `docs/` 下的文档（不含测试报告）
- ✅ **前提条件**: 不涉及代码变更

---

## 四、进入下一阶段的规则

### 4.1 任何 UI 变更必须新增对应 TEST_REPORT
- 任何对 Stage9 UI 的修改（即使是样式微调）都必须生成对应的测试报告
- 测试报告命名规范：`TEST_REPORT_STAGE10_UI_<FEATURE>_YYYYMMDD.md`
- 测试报告必须包含：
  - 变更文件清单
  - 真实命令（lint/build/guards）
  - 每条命令真实输出关键片段
  - 功能零变化声明
  - Stage6/7/8 Guard 全 PASS 证据

### 4.2 冻结解除条件
- 冻结解除需要明确的 Stage 规划文档
- 冻结解除需要完整的迁移计划
- 冻结解除需要全量回归验证通过

---

## 五、违规处理

### 5.1 违规检测
- CI Guard 将检测对冻结文件的修改
- 任何对冻结文件的修改都会触发 CI 失败

### 5.2 违规处理流程
1. 识别违规修改
2. 要求提供"为何必须修"的说明
3. 要求生成对应的测试报告
4. 要求通过全量回归验证
5. 更新冻结声明文档（如需要）

---

## 六、冻结声明生效

**生效时间**: 2025-12-13  
**生效范围**: 整个代码库  
**生效条件**: 
- ✅ Stage10 验收已完成
- ✅ 全量回归验证通过
- ✅ 手工验收清单全部通过
- ✅ 冻结声明文档已生成并进入 git 变更集

---

## 七、签名

- **冻结执行者**: AI Assistant (Cursor)
- **冻结时间**: 2025-12-13
- **冻结状态**: ✅ **ACTIVE（生效中）**

---

**声明文件**: `docs/STAGE10_UI_FREEZE_DECLARATION.md`

