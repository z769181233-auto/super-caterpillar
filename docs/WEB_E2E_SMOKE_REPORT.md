## Web E2E Smoke 测试报告

生成时间：2025-12-18  
命令：`pnpm --filter web test:e2e`（Playwright）

---

## 1. 环境前置条件

E2E 测试依赖：

- API 服务已在本地运行：`http://localhost:3000`
- Web 前端已可通过 Playwright 访问（同一 origin）
- 测试账号存在：`admin@example.com` / `password123`（或配置为环境变量）
- 部分用例依赖环境变量：
  - `SNAP_PROJECT_ID`（用于快照用例）

本次在纯 CLI 环境中运行，未额外启动 API / Web 服务，也未设置上述环境变量。

---

## 2. 执行结果概览

- 命令：`pnpm --filter web test:e2e`
- 结果：**6 个用例全部失败**

### 失败用例明细

1. `e2e/smoke.spec.ts`
   - 完整流程：登录 → 创建项目 → 查看项目详情 → 创建层级结构
   - 失败原因：`page.waitForURL(/\/projects/, { timeout: 60000 })` 超时
     - 说明：访问 `/login` 后未成功跳转到 `/projects`，高度怀疑是 **后端未启动或登录失败**。

2. `e2e/smoke.spec.ts`
   - 未登录访问受保护页面应跳转到登录页
   - 失败原因：`page.waitForURL('/login', { timeout: 60000 })` 超时
     - 说明：访问 `/projects` 后未触发到 `/login` 重定向，可能是 **中间件/路由未生效或后端未运行**。

3. `e2e/smoke.spec.ts`
   - Studio v0.3: 导演工作台批量操作流程
   - 失败原因：再次卡在 `waitForURL(/\/projects/)`，与用例 1 相同根因。

4. `e2e/smoke.spec.ts`
   - Studio v0.5: Job Dashboard 运维流程
   - 失败原因：同样卡在登录后跳转 `/projects` 的等待。

5. `e2e/snapshots.spec.ts`
   - UI snapshots: overview + structure tree
   - 失败原因：`Error: Missing SNAP_PROJECT_ID`
     - 说明：环境变量未设置，属 **环境配置缺失**，非代码逻辑错误。

6. `e2e/verify-stage4-ui.spec.ts`
   - Stage 4 UI Verification：完整流程：创建项目 -> 创建结构 -> 触发语义分析 -> 验证面板数据
   - 失败原因：整体用例超时（120s），在 `page.fill('input[type="email"]', 'admin@example.com')` 卡住
     - 说明：页面可能未正确渲染登录表单，多为 **后端未启动 / 路由未可用** 的连锁效应。

---

## 3. 诊断结论

- 从错误模式看，**主要是环境未启动 / 未配置导致的系统级失败**：
  - 登录页无法正常完成跳转 → 很可能 API 未提供预期的登录响应。
  - 受保护页面未重定向登录 → 可能是中间件或 auth 配置未生效，或仍然是后端未运行。
  - `SNAP_PROJECT_ID` 缺失 → 直接阻断了 snapshot 用例。
- **当前没有直接暴露“字段不对齐”或“接口 4xx/5xx 兼容性问题”的证据**，因为大部分用例在非常靠前的导航阶段就超时了。

---

## 4. 建议复现步骤（本地完整通过的建议路径）

1. 启动后端 & 前端：
   - 在项目根目录：
     - `pnpm --filter api start:dev`（或你的 API 启动脚本）
     - `pnpm --filter web dev` 或使用生产 build + `next start`

2. 准备测试账号：
   - 确保数据库中存在 `admin@example.com / password123`，或在 E2E 前执行初始化脚本。

3. 设置必要环境变量：
   - `export SNAP_PROJECT_ID=<一个已存在且可访问的项目 ID>`

4. 再次运行：
   - `pnpm --filter web test:e2e`

5. 如果仍有失败：
   - 优先检查对应 `test-results/*/error-context.md`，确认是 **字段/契约问题**，还是 **数据准备/权限问题**。

---

## 5. 风险评估

- **当前 E2E 失败的主因是环境未准备充分**，而非直接的字段不对齐或重大逻辑错误；
- 只要按建议准备环境，预期用例可进一步跑通，并暴露更细粒度的 UI/字段问题；
- 就“字段对齐”视角而言，本轮 E2E 未发现新字段不一致问题（因为尚未走到深度表单交互阶段）。
