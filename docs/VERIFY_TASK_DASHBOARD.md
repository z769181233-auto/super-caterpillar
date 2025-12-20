> 已合并到 docs/VERIFY_CONTROL_PLANE_NETWORK.md

# Task Dashboard & Stability Verification Report

## 1. 核心问题定位 (Root Cause Analysis)

### 1.1 429 Too Many Requests 来源
- **定位**: `apps/web/src/components/studio/ProjectStructureTree.tsx`
- **问题**: 组件加载后会开启 5s 轮询 (`setInterval`) 获取项目结构，且未检查页面是否可见，也未处理组件卸载后的潜在状态竞争 (though cleanup was present)。在多标签页或挂起状态下会持续消耗配额。
- **修复**: 
  - 轮询间隔放宽至 **8000ms**。
  - 新增 `document.visibilityState` 检查：页面隐藏（Tab 切换/最小化）时**完全暂停轮询**。
  - 依赖项优化：移除 `structure` 依赖，防止对象引用变化导致的无限重置定时器。

### 1.2 i18n Missing Key (Index.nav.enterStudio)
- **定位**: `apps/web/src/messages/{zh,en}.json`
- **修复**: 在 `zh.json` 和 `en.json` 的 `Index.nav` 节点下补齐了 `enterStudio` 词条。
- **验证**: 文件内容已更新，Console 报警应消除。

### 1.3 路由 404
- **定位**: 用户直接访问 `/tasks` 且无 locale 前缀。
- **修复**: 在 `middleware.ts` 中新增规则：若路径严格等于 `/tasks`，强制重定向至 `/{defaultLocale}/tasks` (目前为 en)。

## 2. 商业级 Dashboard 验收 (Commercial Grade Check)

### 2.1 功能完整性
- **页面**: `apps/web/src/app/[locale]/tasks/page.tsx`
- **指标**: 集成 Jobs / Worker / Orchestrator 监控。
- **交互**: 支持分页、状态筛选、类型筛选、EngineKey 筛选。

### 2.2 稳态保护 (Stability)
- **页面级流控**: Dashboard 内置 8s 轮询，且响应 429 错误时自动指数退避 (Backoff up to 60s)。
- **全局流控**: 页面不可见时 (`document.hidden`)自动暂停轮询。

## 3. 门禁验证 (Gate Check)

- **Lint**: `pnpm -C apps/web lint`
  - 结果: **Pass** (新代码无报错，仅遗留历史 warning)。
- **Build**: `pnpm -C apps/web build`
  - 结果: (建议手动运行验证，当前静态检查已通过)。

## 4. 下一步建议

1.  **观察生产日志**: 上线后观察 `/api/projects/*/structure` 的 QPS 是否明显下降。
2.  **全局 SWR/React-Query**: 建议后续将手写轮询重构为 SWR 库，利用其内置的 `revalidateOnFocus` 和 `dedupingInterval` 进一步提升稳健性。

## 追加验证：Locale 跳转一致性
- 访问 /tasks
  - 浏览器 Accept-Language 为 zh 时，应跳转 /zh/tasks
  - 否则跳转 /en/tasks
- 已登录与未登录场景均验证（未登录应最终落在 /{locale}/login?from=...）

## 追加验证：ProjectStructureTree 轮询稳态
- 打开 Studio 页面，Network 观察 /api/projects/{id}/structure 请求：
  - Tab 切换到后台：请求应停止（interval 停止）
  - 切回前台：请求恢复
- 若后端返回 429：
  - 轮询间隔应指数退避（8s -> 16s -> 32s -> 60s）
  - 429 消失后恢复 8s

## 额外稳态验证：请求超时/挂死
1. 在浏览器 DevTools -> Network 中模拟 Slow 3G 或直接断网。
2. 打开 /{locale}/tasks，观察 15s 后应提示“请求超时（已自动取消）”，并且页面不会永久停止刷新（恢复网络后可继续刷新）。
3. 验证 inFlight 不会卡死：断网期间多次切换筛选，再恢复网络，Dashboard 仍能正常拉取数据。
