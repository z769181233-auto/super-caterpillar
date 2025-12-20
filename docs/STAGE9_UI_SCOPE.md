# Stage9 · UI 影响范围清单

**生成时间**: 2025-12-13 09:37:50
**说明**: 本清单仅用于明确 UI 边界，不允许修改功能逻辑

## 一、前端页面 (apps/web/src/app)

- `dev`
- `globals.css`
- `layout.tsx`
- `login`
- `monitor`
- `page.tsx`
- `projects`
- `studio`
- `tasks`

## 二、前端组件 (apps/web/src/components)

- `components/studio/ShotPlanningPanel.tsx`
- `components/studio/QualityHintPanel.tsx`
- `components/studio/SemanticInfoPanel.tsx`
- `components/studio/ProjectStructureTree.tsx`
- `components/quality/QualityScoreBadge.tsx`
- `components/project/StudioTree.tsx`
- `components/project/DetailPanel.tsx`
- `components/project/AnalysisStatusPanel.tsx`
- `components/project/ProjectStructureTree.tsx`
- `components/project/ContentList.tsx`
- `components/engines/EngineFilter.tsx`
- `components/engines/EngineProfilePanel.tsx`
- `components/engines/AdapterBadge.tsx`
- `components/engines/EngineTag.tsx`
- `components/engines/EngineSummaryPanel.tsx`
- `components/UserInfo.tsx`
- `components/ShotEditor.tsx`

## 三、样式文件 (apps/web/src/styles)

## 四、UI 优化允许范围

✅ **允许修改**: 
- UI 组件 (apps/web/src/components/**)
- 页面布局 (apps/web/src/app/**)
- 样式文件 (apps/web/src/styles/**)
- 交互细节 (hover / loading / empty state)

❌ **禁止修改**: 
- API 接口
- Worker / Job / Guard / Script
- 数据库 / Prisma / Schema
- Stage5-8 的 CI Guard
- Props 语义 / 状态流转

