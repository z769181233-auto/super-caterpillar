# 前端联调报告

**生成时间**: 2025-12-07  
**状态**: ✅ 已完成基础联调

---

## 一、已实现的前端页面列表

### 1. 登录页面 (`/login`)

**功能**:

- 邮箱和密码输入
- 登录按钮
- 错误提示显示
- 登录成功后自动跳转到项目列表

**调用的后端接口**:

- `POST /api/auth/login`

**实现文件**: `apps/web/src/app/login/page.tsx`

---

### 2. 项目列表页面 (`/projects`)

**功能**:

- 显示项目列表（当前后端暂未实现列表接口，显示为空）
- 创建新项目表单
- 项目卡片展示（名称、描述、创建时间）
- 点击项目卡片跳转到项目详情页

**调用的后端接口**:

- `GET /api/projects` (TODO: 后端暂未实现，当前返回空数组)
- `POST /api/projects` (创建项目)

**实现文件**: `apps/web/src/app/projects/page.tsx`

---

### 3. 项目详情页面 (`/projects/[id]`)

**功能**:

- 四栏布局展示层级结构：
  - Seasons 列
  - Episodes 列
  - Scenes 列
  - Shots 列
- 每列支持创建新项
- 选中项联动显示下级内容
- 实时更新层级结构

**调用的后端接口**:

- `GET /api/projects/:id` (获取项目详情，包含完整层级)
- `POST /api/projects/:projectId/seasons` (创建 Season)
- `POST /api/projects/seasons/:seasonId/episodes` (创建 Episode)
- `POST /api/projects/episodes/:episodeId/scenes` (创建 Scene)
- `POST /api/projects/scenes/:sceneId/shots` (创建 Shot)

**实现文件**: `apps/web/src/app/projects/[id]/page.tsx`

---

### 4. 首页 (`/`)

**功能**:

- 自动检测 token
- 有 token 则跳转到 `/projects`
- 无 token 则跳转到 `/login`

**实现文件**: `apps/web/src/app/page.tsx`

---

### 5. 用户信息组件

**功能**:

- 显示当前用户邮箱
- 退出登录按钮
- 自动获取用户信息

**调用的后端接口**:

- `GET /api/users/me`

**实现文件**: `apps/web/src/components/UserInfo.tsx`

---

## 二、已打通的完整业务链路

### 链路 1: 登录 → 项目列表 → 创建项目 → 项目详情

1. **登录** (`/login`)
   - 用户输入邮箱和密码
   - 调用 `POST /api/auth/login`
   - 保存 accessToken 和 refreshToken 到 localStorage
   - 跳转到 `/projects`

2. **项目列表** (`/projects`)
   - 显示项目列表（当前为空，因为后端暂未实现列表接口）
   - 点击「创建新项目」打开表单
   - 调用 `POST /api/projects` 创建项目
   - 创建成功后跳转到项目详情页

3. **项目详情** (`/projects/[id]`)
   - 调用 `GET /api/projects/:id` 获取项目完整层级
   - 显示 Seasons → Episodes → Scenes → Shots 四栏结构

### 链路 2: 创建完整层级结构

1. **创建 Season**
   - 在项目详情页点击「+ 新增」按钮
   - 填写 index 和 name
   - 调用 `POST /api/projects/:projectId/seasons`
   - 刷新项目数据，显示新创建的 Season

2. **创建 Episode**
   - 选中一个 Season
   - 点击「+ 新增」按钮
   - 填写 index 和 name
   - 调用 `POST /api/projects/seasons/:seasonId/episodes`
   - 刷新项目数据，显示新创建的 Episode

3. **创建 Scene**
   - 选中一个 Episode
   - 点击「+ 新增」按钮
   - 填写 index 和 summary
   - 调用 `POST /api/projects/episodes/:episodeId/scenes`
   - 刷新项目数据，显示新创建的 Scene

4. **创建 Shot**
   - 选中一个 Scene
   - 点击「+ 新增」按钮
   - 填写 index、type
   - 调用 `POST /api/projects/scenes/:sceneId/shots`
   - 刷新项目数据，显示新创建的 Shot

---

## 三、API 客户端架构

### 统一 API Client

**文件**: `apps/web/src/lib/apiClient.ts`

**功能**:

- 统一封装 HTTP 请求（GET/POST/PATCH/DELETE）
- 自动附加 Authorization 头（Bearer token）
- 统一处理错误响应
- 支持自动刷新 token（预留扩展点）
- 401 时自动跳转登录页

**导出的 API 方法**:

```typescript
// 认证相关
authApi.login(email, password)
authApi.register(email, password, userType?)
authApi.logout()

// 用户相关
userApi.getCurrentUser()
userApi.getQuota()

// 项目相关
projectApi.getProjects()
projectApi.getProjectById(id)
projectApi.createProject(name, description?)
projectApi.updateProject(id, data)
projectApi.deleteProject(id)
projectApi.createSeason(projectId, index, name)
projectApi.createEpisode(seasonId, index, name)
projectApi.createScene(episodeId, index, summary?, metadata?)
projectApi.updateScene(id, data)
projectApi.createShot(sceneId, index, type, params)
projectApi.getShot(id)
projectApi.updateShot(id, data)
```

### API 配置

**文件**: `apps/web/src/config/api.ts`

**配置项**:

- `baseURL`: 从环境变量 `NEXT_PUBLIC_API_BASE_URL` 读取，默认 `http://localhost:3000/api`
- `timeout`: 请求超时时间（30秒）

---

## 四、状态管理与错误处理

### Token 管理

**当前实现**:

- 使用 `localStorage` 存储 `accessToken` 和 `refreshToken`
- TODO: 应改为 httpOnly cookie（需要后端支持）

**方法**:

- `apiClient.setToken(token)`: 保存 token
- `apiClient.clearToken()`: 清除 token
- `apiClient.getToken()`: 获取 token

### 错误处理

**统一错误格式**:

```typescript
interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
}
```

**错误处理逻辑**:

- 401 未授权：尝试刷新 token，失败则清除 token 并跳转登录
- 其他错误：显示错误消息给用户

### 加载状态

**实现方式**:

- 使用 `useState` 管理 `loading` 状态
- 在请求期间显示「加载中...」提示
- 请求完成后隐藏加载状态

### 空态处理

**实现位置**:

- 项目列表页：显示「当前没有项目」提示
- 项目详情页：各列显示「暂无 XXX」或「请先选择 XXX」提示

---

## 五、路由守卫

### 实现方式

**文件**: `apps/web/src/middleware.ts`

**功能**:

- 检查受保护的路由（`/projects` 及其子路由）
- 当前仅做路径检查，实际 token 验证在客户端组件中进行

**客户端验证**:

- 在需要认证的页面组件中，调用 API 时如果返回 401，自动跳转到 `/login`
- 在 `UserInfo` 组件中，获取用户信息失败时跳转登录

---

## 六、已知限制 / TODO 列表

### 功能限制

1. **项目列表接口未实现**
   - 后端暂未实现 `GET /api/projects` 列表接口
   - 当前前端返回空数组
   - TODO: 实现后端列表接口或使用 mock 数据

2. **Token 存储方式**
   - 当前使用 localStorage，存在 XSS 风险
   - TODO: 改为 httpOnly cookie（需要后端支持）

3. **Token 刷新机制**
   - 已预留扩展点，但未完全实现
   - TODO: 完善 token 刷新逻辑

4. **错误重试机制**
   - 当前无自动重试
   - TODO: 添加网络错误自动重试

### UI/UX 限制

1. **样式设计**
   - 仅为基础样式，未做复杂设计
   - TODO: 添加 Tailwind CSS 或设计系统

2. **表单校验**
   - 仅使用 HTML5 基础校验
   - TODO: 添加复杂表单校验（如邮箱格式、密码强度）

3. **响应式设计**
   - 未做移动端适配
   - TODO: 添加响应式布局

4. **国际化**
   - 未做 i18n 支持
   - TODO: 添加多语言支持

5. **加载动画**
   - 仅显示文字「加载中...」
   - TODO: 添加 Skeleton 或 Loading 动画

### 测试限制

1. **自动化测试**
   - 未配置 E2E 测试
   - TODO: 添加 Playwright 或 Cypress 测试

2. **单元测试**
   - 未配置单元测试
   - TODO: 添加 React Testing Library 测试

---

## 七、技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **UI**: 基础 HTML/CSS（未使用 UI 库）
- **状态管理**: React Hooks (useState, useEffect)
- **路由**: Next.js App Router
- **HTTP 客户端**: Fetch API (封装为 apiClient)

---

## 八、文件结构

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局（包含 UserInfo）
│   │   ├── page.tsx                # 首页（自动跳转）
│   │   ├── globals.css             # 全局样式
│   │   ├── login/
│   │   │   └── page.tsx            # 登录页
│   │   └── projects/
│   │       ├── page.tsx            # 项目列表页
│   │       └── [id]/
│   │           └── page.tsx        # 项目详情页
│   ├── components/
│   │   └── UserInfo.tsx            # 用户信息组件
│   ├── config/
│   │   └── api.ts                  # API 配置
│   ├── lib/
│   │   └── apiClient.ts            # API 客户端
│   └── middleware.ts               # 路由守卫
├── package.json
├── next.config.js
└── tsconfig.json
```

---

## 九、启动与测试

### 启动步骤

1. **启动后端**（如果未启动）:

   ```bash
   pnpm dev:api
   ```

2. **启动前端**:

   ```bash
   pnpm dev:web
   ```

3. **访问前端**:
   打开浏览器访问 `http://localhost:3001`

### 测试流程

1. 访问首页，应自动跳转到登录页
2. 输入邮箱和密码登录
3. 登录成功后跳转到项目列表页
4. 创建新项目
5. 进入项目详情页
6. 依次创建 Season → Episode → Scene → Shot
7. 验证层级结构正确显示

---

## 十、总结

### ✅ 已完成

1. ✅ 统一 API 客户端封装
2. ✅ 登录页面实现与联调
3. ✅ 用户信息获取与显示
4. ✅ 项目列表页面（基础功能）
5. ✅ 项目详情页面（完整层级结构）
6. ✅ 创建 Season/Episode/Scene/Shot 功能
7. ✅ 错误处理和加载状态
8. ✅ 路由守卫（基础实现）

### ⚠️ 待完善

1. ⚠️ 后端项目列表接口
2. ⚠️ Token 存储改为 httpOnly cookie
3. ⚠️ UI 样式优化
4. ⚠️ 表单校验增强
5. ⚠️ 响应式设计
6. ⚠️ 自动化测试

### 🎯 下一步建议

1. 实现后端项目列表接口
2. 添加 Tailwind CSS 或设计系统
3. 完善 token 刷新机制
4. 添加 E2E 测试
5. 优化移动端体验

---

---

## 十一、第二阶段联调（Studio v0.1）

**完成时间**: 2025-12-07  
**版本**: v0.1

### ✅ 新增后端接口

#### 1. `GET /api/projects` - 项目列表接口

**功能**:

- 返回当前用户有权限看到的项目列表
- 支持分页参数（page, pageSize），默认单页全量返回
- 返回字段：id, name, description, createdAt, updatedAt, status

**实现文件**:

- `apps/api/src/project/project.controller.ts`
- `apps/api/src/project/project.service.ts` (新增 `findAll` 方法)

**E2E 测试**:

- `apps/api/test/e2e/project-list.e2e-spec.ts`
- 测试覆盖：未登录 401、登录后获取列表、空列表情况

#### 2. `GET /api/projects/:id/tree` - 项目树聚合接口

**功能**:

- 一次返回 Project → Seasons → Episodes → Scenes → Shots 的完整树结构
- 优化前端数据获取，减少请求数
- 返回结构包含每级的 id、name、index、状态字段

**实现文件**:

- `apps/api/src/project/project.controller.ts`
- `apps/api/src/project/project.service.ts` (新增 `findTreeById` 方法)

**E2E 测试**:

- `apps/api/test/e2e/project-tree.e2e-spec.ts`
- 测试覆盖：完整层级结构、层级关系正确性

### ✅ 安全加固：httpOnly Cookie

#### 后端改造

**修改文件**:

- `apps/api/src/main.ts` - 添加 cookie-parser 中间件
- `apps/api/src/auth/auth.controller.ts` - 登录/注册/刷新接口设置 httpOnly cookie
- `apps/api/src/auth/jwt.strategy.ts` - 从 cookie 读取 token（兼容 Authorization header）

**Cookie 配置**:

- `httpOnly: true` - 防止 XSS 攻击
- `secure: true` (生产环境) - 仅 HTTPS 传输
- `sameSite: 'strict'` (生产环境) / `'lax'` (开发环境) - CSRF 防护
- `maxAge: 7 days` (accessToken) / `30 days` (refreshToken)

**新增接口**:

- `POST /api/auth/logout` - 清除 cookie

#### 前端改造

**修改文件**:

- `apps/web/src/lib/apiClient.ts` - 移除 localStorage token 逻辑，使用 cookie 自动携带
- `apps/web/src/components/UserInfo.tsx` - 更新 logout 逻辑
- `apps/web/src/app/page.tsx` - 移除 localStorage 检查

**改进**:

- ✅ Token 通过 httpOnly cookie 自动管理，无需手动处理
- ✅ 所有请求自动携带 cookie（`credentials: 'include'`）
- ✅ 401 时自动尝试刷新 token（通过 cookie）

### ✅ Studio 风格 UI 升级

#### 项目列表页 (`/projects`)

**新设计**:

- 左侧固定栏（320px）：项目列表 + 创建表单
- 右侧占位区域：提示选择项目
- 卡片式项目展示，hover 效果
- 清晰的视觉层次和间距

**改进点**:

- ✅ 更清晰的信息架构
- ✅ 更好的视觉反馈（hover、选中状态）
- ✅ 统一的卡片样式

#### 项目详情页 (`/projects/[id]`)

**新设计**:

- 左侧导航栏（240px）：项目基本信息 + 返回链接
- 右侧主内容区：四栏网格布局（Seasons / Episodes / Scenes / Shots）
- 每列独立卡片，支持滚动
- 选中状态高亮显示

**改进点**:

- ✅ 更清晰的层级结构展示
- ✅ 更好的交互体验（选中联动）
- ✅ 统一的创建表单样式

### ✅ 前端自动化冒烟测试

**测试工具**: Playwright

**测试文件**: `apps/web/e2e/smoke.spec.ts`

**测试用例**:

1. **完整流程测试**:
   - 打开登录页
   - 登录成功
   - 进入项目列表
   - 创建新项目
   - 进入项目详情
   - 验证项目树结构存在
   - 验证创建入口可见

2. **未登录访问测试**:
   - 清除 cookies
   - 访问受保护页面
   - 验证自动跳转到登录页

**测试命令**:

```bash
cd apps/web
pnpm test:e2e        # 运行测试
pnpm test:e2e:ui     # 运行测试（UI 模式）
```

**前置条件**:

- 后端 API 服务必须已启动（`pnpm dev:api`）
- 测试账号必须存在（email: `test@example.com`, password: `password123`）

### ✅ 新增/修改的主要文件

#### 后端文件

1. `apps/api/src/project/project.controller.ts` - 添加 `GET /api/projects` 和 `GET /api/projects/:id/tree`
2. `apps/api/src/project/project.service.ts` - 添加 `findAll` 和 `findTreeById` 方法
3. `apps/api/src/auth/auth.controller.ts` - 改造为 httpOnly cookie
4. `apps/api/src/auth/jwt.strategy.ts` - 支持从 cookie 读取 token
5. `apps/api/src/main.ts` - 添加 cookie-parser 中间件
6. `apps/api/test/e2e/project-list.e2e-spec.ts` - 项目列表 E2E 测试
7. `apps/api/test/e2e/project-tree.e2e-spec.ts` - 项目树 E2E 测试

#### 前端文件

1. `apps/web/src/app/projects/page.tsx` - Studio 风格项目列表页
2. `apps/web/src/app/projects/[id]/page.tsx` - Studio 风格项目详情页
3. `apps/web/src/lib/apiClient.ts` - 移除 localStorage，使用 cookie
4. `apps/web/src/components/UserInfo.tsx` - 更新 logout
5. `apps/web/src/app/page.tsx` - 移除 localStorage 检查
6. `apps/web/e2e/smoke.spec.ts` - Playwright 冒烟测试
7. `apps/web/playwright.config.ts` - Playwright 配置

### ✅ 当前已打通的端到端使用路径

1. **完整创建流程**:
   - 登录 → 项目列表 → 创建项目 → 项目详情 → 创建 Season → 创建 Episode → 创建 Scene → 创建 Shot
   - 所有操作实时同步，层级结构正确显示

2. **数据获取优化**:
   - 项目列表：单次请求获取所有项目
   - 项目详情：单次请求获取完整树结构（`/api/projects/:id/tree`）

3. **安全流程**:
   - 登录：Token 自动设置到 httpOnly cookie
   - 请求：Cookie 自动携带，无需手动处理
   - 刷新：Token 刷新通过 cookie 自动完成
   - 登出：清除 cookie

### ⚠️ 已知限制

1. **分页功能**:
   - 当前实现基础分页参数，但默认返回全量
   - TODO: 实现完整分页逻辑和前端分页组件

2. **UI 优化**:
   - 当前为 Studio 风格初版，可进一步优化
   - TODO: 添加更多交互细节、动画效果

3. **测试覆盖**:
   - 前端测试仅覆盖关键路径
   - TODO: 增加更多测试场景（错误处理、边界情况）

---

---

## 十二、第三阶段联调（Studio v0.2 - 镜头编辑 & 生成工作流）

**完成时间**: 2025-12-07  
**版本**: v0.2

### ✅ 扩展数据模型

#### Shot 模型扩展

**新增字段**:

- `title` (String?) - 镜头标题
- `description` (String?) - 画面内容/动作/环境描述
- `dialogue` (String?) - 对白或配音文本
- `prompt` (String?) - 下发给生成引擎的最终 Prompt
- `reviewStatus` (ShotReviewStatus) - 审核状态：PENDING/APPROVED/REJECTED
- `reviewNote` (String?) - 驳回原因/修改建议
- `previewUrl` (String?) - 生成结果的预览链接
- `generatedAt` (DateTime?) - 生成完成时间
- `reviewedAt` (DateTime?) - 审核时间

**状态枚举扩展**:

- `ShotStatus`: 新增 `DRAFT`, `READY`, `GENERATING`, `GENERATED`, `FAILED`（保持向后兼容旧状态）
- `ShotReviewStatus`: 新增枚举 `PENDING`, `APPROVED`, `REJECTED`

#### ShotJob 模型（新增）

**字段**:

- `id`, `shotId`, `type` (JobType), `status` (JobStatus)
- `payload` (Json) - 生成请求参数
- `result` (Json?) - 生成结果元数据
- `startedAt`, `finishedAt`, `createdAt`, `updatedAt`

**枚举**:

- `JobType`: IMAGE, VIDEO, STORYBOARD, AUDIO
- `JobStatus`: PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED

### ✅ 生成任务 Job API

#### 接口列表

1. **`POST /api/shots/:shotId/jobs`** - 创建生成任务
   - Request Body: `{ type: 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO', payload?: any }`
   - Response: Job 对象
   - 行为：创建 Job，异步处理（Mock），自动更新 Shot 状态

2. **`GET /api/shots/:shotId/jobs`** - 获取 Shot 的所有任务
   - Response: Job 数组（按创建时间倒序）

3. **`GET /api/jobs/:id`** - 获取单个 Job 详情
   - Response: Job 对象（包含关联的 Shot 信息）

#### Mock 生成流程

**当前实现**:

- 创建 Job 后，异步处理（模拟 1-3 秒延迟）
- 状态流转：`PENDING` → `RUNNING` → `SUCCEEDED` / `FAILED`
- 自动更新 Shot：
  - `status` = `GENERATING` → `GENERATED` / `FAILED`
  - `previewUrl` = 生成结果中的 URL
  - `generatedAt` = 当前时间

**后续接入真实 Worker**:

- `MockJobProcessor` 可替换为真实 Worker 调用
- 预留接口：`JobService.processJobAsync()` 方法

### ✅ 前端 Shot 编辑面板

#### ShotEditor 组件

**位置**: `apps/web/src/components/ShotEditor.tsx`

**功能**:

1. **编辑模式**:
   - 编辑 title, description, dialogue, prompt
   - 保存按钮调用 `PATCH /api/projects/shots/:id`

2. **查看模式**:
   - 显示 Shot 基本信息
   - 显示状态标签（Status, ReviewStatus）
   - 显示预览（如果有 previewUrl）

3. **生成控制**:
   - 「发起生成」按钮：调用 `POST /api/shots/:shotId/jobs`
   - 生成中状态显示
   - Job 历史列表（最近 5 条）

4. **审核功能**:
   - 「通过」按钮：更新 `reviewStatus = APPROVED`
   - 「驳回」按钮：打开对话框，输入 `reviewNote`，更新 `reviewStatus = REJECTED`

#### 集成到项目详情页

**布局**:

- 左侧：四栏结构（Seasons / Episodes / Scenes / Shots）
- 右侧：Shot 编辑面板（ShotEditor 组件）

**交互**:

- 点击 Shots 列表中的 Shot，右侧显示编辑面板
- 自动选中第一个 Shot（如果存在）

### ✅ 基础审核流

#### 审核状态管理

**字段**:

- `reviewStatus`: PENDING / APPROVED / REJECTED
- `reviewNote`: 驳回原因/修改建议
- `reviewedAt`: 审核时间

**操作**:

- 通过：设置 `reviewStatus = APPROVED`, `reviewedAt = now`
- 驳回：设置 `reviewStatus = REJECTED`, `reviewNote = 用户输入`, `reviewedAt = now`

**权限**:

- 当前无完整权限系统，所有登录用户可审核
- TODO: 后续接入完整 PermissionModule

### ✅ 新增/修改的主要文件

#### 后端文件

1. `packages/database/prisma/schema.prisma` - 扩展 Shot 模型，新增 ShotJob 模型
2. `apps/api/src/job/job.module.ts` - Job 模块
3. `apps/api/src/job/job.service.ts` - Job 服务（含 Mock 处理器）
4. `apps/api/src/job/job.controller.ts` - Job 控制器
5. `apps/api/src/job/dto/create-job.dto.ts` - 创建 Job DTO
6. `apps/api/src/project/dto/update-shot.dto.ts` - 扩展 UpdateShotDto
7. `apps/api/src/project/project.service.ts` - 更新 findTreeById 包含新字段
8. `apps/api/src/app.module.ts` - 添加 JobModule

#### 前端文件

1. `apps/web/src/components/ShotEditor.tsx` - Shot 编辑面板组件（新建）
2. `apps/web/src/app/projects/[id]/page.tsx` - 集成 ShotEditor，添加选中功能
3. `apps/web/src/lib/apiClient.ts` - 添加 Job API 方法

### ✅ 当前已打通的端到端使用路径

1. **完整编辑流程**:
   - 选择 Shot → 编辑 title/description/dialogue/prompt → 保存
   - 发起生成 → 查看生成进度 → 查看生成结果（previewUrl）
   - 审核：通过/驳回 → 查看审核状态

2. **生成工作流**:
   - 创建 Job → Mock 处理（1-3秒）→ 自动更新 Shot 状态和预览
   - 查看 Job 历史 → 了解生成记录

### ⚠️ 已知限制

1. **生成流程为 Mock**:
   - 当前使用 `MockJobProcessor` 模拟生成
   - TODO: 接入真实 Worker/引擎

2. **审核权限**:
   - 当前无权限控制，所有用户可审核
   - TODO: 接入完整 PermissionModule

3. **预览功能**:
   - 当前仅显示 previewUrl 链接
   - TODO: 实现图片/视频预览组件

4. **批量操作**:
   - 当前不支持批量操作
   - TODO: 实现批量生成、批量审核

---

---

## 十三、第四阶段联调（Studio v0.3 - 导演工作台 / 批量审片）

**完成时间**: 2025-12-07  
**版本**: v0.3

### ✅ Shot 全局查询与过滤 API

#### 接口：`GET /api/projects/shots`

**查询参数**（全部可选）:

- `projectId` - 项目 ID
- `seasonId` - Season ID
- `episodeId` - Episode ID
- `sceneId` - Scene ID
- `status` - 生成状态（DRAFT/READY/GENERATING/GENERATED/FAILED）
- `reviewStatus` - 审核状态（PENDING/APPROVED/REJECTED）
- `q` - 关键词搜索（匹配 title/description/dialogue/prompt）
- `page` / `pageSize` - 分页参数

**返回内容**:

- `shots` - Shot 数组，每条包含：
  - Shot 基本字段（id, title, status, reviewStatus, previewUrl, generatedAt, reviewedAt）
  - 所属层级信息（projectId, projectName, seasonId, seasonName, episodeId, episodeName, sceneId, sceneIndex）
- `total` - 总数
- `page`, `pageSize`, `totalPages` - 分页信息

**实现文件**:

- `apps/api/src/project/project.service.ts` - `listShots` 方法
- `apps/api/src/project/project.controller.ts` - `GET /api/projects/shots` 路由
- `apps/api/src/project/dto/list-shots.dto.ts` - 查询参数 DTO

**E2E 测试**:

- `apps/api/test/e2e/shots-list.e2e-spec.ts`
- 测试覆盖：未登录 401、登录后获取列表、按 projectId/status 过滤、分页功能

### ✅ Shot 批量操作 API

#### 接口列表

1. **`POST /api/projects/shots/batch/review`** - 批量审核
   - Request Body: `{ shotIds: string[], reviewStatus: 'APPROVED' | 'REJECTED', reviewNote?: string }`
   - Response: `{ updated: number, shots: Shot[] }`
   - 行为：批量更新指定 Shots 的 reviewStatus、reviewNote、reviewedAt

2. **`POST /api/projects/shots/batch/generate`** - 批量发起生成
   - Request Body: `{ shotIds: string[], jobType: 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' }`
   - Response: `{ created: number, total: number, jobs: Job[] }`
   - 行为：为每个 Shot 创建 Job，使用 Mock 方式异步处理

**实现文件**:

- `apps/api/src/project/project.controller.ts` - 批量操作路由
- `apps/api/src/project/project.service.ts` - 权限检查（复用现有方法）

**E2E 测试**:

- `apps/api/test/e2e/shots-batch.e2e-spec.ts`
- 测试覆盖：批量审核、批量驳回、批量生成

### ✅ 导演工作台页面

#### 页面路径

**`/studio/review`**

#### 页面结构

**左侧过滤栏**（280px）:

- 关键词搜索框（搜索 title/description/dialogue）
- 生成状态下拉（DRAFT/READY/GENERATING/GENERATED/FAILED）
- 审核状态下拉（PENDING/APPROVED/REJECTED）
- 项目 ID 输入框
- 清除筛选按钮

**右侧主内容区**:

- **统计条**（顶部）:
  - 总计 Shots 数
  - 各 status 数量（带颜色标签）
  - 各 reviewStatus 数量（带颜色标签）

- **批量操作栏**（选中 Shots 时显示）:
  - 「批量通过」按钮
  - 「批量驳回」按钮（弹出对话框输入原因）
  - 「批量生成」按钮
  - 「取消选择」按钮

- **Shots 表格**:
  - 列：复选框、标题、所属层级、状态、审核状态、生成时间、操作
  - 支持多选（checkbox）
  - 每行显示：Shot 标题、项目/Season/Episode/Scene 信息、状态标签、预览链接、打开项目链接

- **分页**（底部）:
  - 显示当前页/总页数
  - 上一页/下一页按钮

#### 实现文件

- `apps/web/src/app/studio/review/page.tsx` - 导演工作台页面（新建）
- `apps/web/src/lib/apiClient.ts` - 添加 `listShots`, `batchReview`, `batchGenerate` 方法
- `apps/web/src/components/UserInfo.tsx` - 添加「导演工作台」导航链接

### ✅ 基础统计视图

**实现方式**:

- 前端根据当前列表数据本地统计
- 统计项：
  - 总 Shots 数（`stats.total`）
  - 各 status 数量（`stats.byStatus`）
  - 各 reviewStatus 数量（`stats.byReviewStatus`）

**显示位置**:

- 导演工作台页面顶部统计条
- 实时更新（随过滤条件变化）

### ✅ 新增/修改的主要文件

#### 后端文件

1. `apps/api/src/project/dto/list-shots.dto.ts` - 查询参数 DTO（新建）
2. `apps/api/src/project/project.service.ts` - 新增 `listShots` 方法
3. `apps/api/src/project/project.controller.ts` - 新增 `GET /api/projects/shots`, `POST /api/projects/shots/batch/review`, `POST /api/projects/shots/batch/generate`
4. `apps/api/test/e2e/shots-list.e2e-spec.ts` - Shots 列表 E2E 测试（新建）
5. `apps/api/test/e2e/shots-batch.e2e-spec.ts` - 批量操作 E2E 测试（新建）

#### 前端文件

1. `apps/web/src/app/studio/review/page.tsx` - 导演工作台页面（新建）
2. `apps/web/src/lib/apiClient.ts` - 添加导演工作台 API 方法
3. `apps/web/src/components/UserInfo.tsx` - 添加导航链接
4. `apps/web/e2e/smoke.spec.ts` - 添加导演工作台 E2E 测试用例

### ✅ 当前已打通的端到端使用路径

1. **导演工作台流程**:
   - 打开导演工作台 → 应用过滤条件 → 查看 Shots 列表 → 多选 Shots → 批量操作（通过/驳回/生成）→ 查看结果

2. **批量审核流程**:
   - 选择多个 Shots → 批量通过/驳回 → 验证所有 Shots 的 reviewStatus 已更新

3. **批量生成流程**:
   - 选择多个 Shots → 批量生成 → 等待 Mock 处理完成 → 验证所有 Shots 的 status 和 previewUrl 已更新

4. **与项目详情页联动**:
   - 在导演工作台点击「打开项目」→ 跳转到项目详情页

### ⚠️ 已知限制

1. **批量生成进度**:
   - 当前不支持批量操作的进度显示
   - TODO: 添加批量任务进度追踪

2. **性能优化**:
   - 当前查询可能在大数据量时较慢
   - TODO: 添加数据库索引、优化查询性能

3. **过滤条件**:
   - 当前仅支持基础过滤
   - TODO: 支持更复杂的组合过滤、保存过滤条件

4. **排序功能**:
   - 当前仅按创建时间倒序
   - TODO: 支持按状态、审核状态、生成时间等排序

---

---

## 十四、第五阶段改造（Studio v0.4 – Worker & Queue 基础版）

**完成时间**: 2025-12-07  
**版本**: v0.4

### ✅ 增强 Job 模型

#### ShotJob 模型扩展

**新增字段**:

- `priority` (Int, default: 100) - 任务优先级（数值越小优先级越高）
- `attempts` (Int, default: 0) - 已尝试次数
- `maxAttempts` (Int, default: 3) - 最大重试次数
- `scheduledAt` (DateTime?) - 下次允许执行时间（用于延迟重试）
- `lastError` (String?) - 最近一次错误信息
- `lockedAt` (DateTime?) - 执行时加锁时间（避免并发抢占）
- `processor` (String, default: "mock") - 标记由哪个 Processor 处理

**数据库索引**:

- 新增复合索引：`[status, priority, scheduledAt]` - 用于 Worker 高效查询

### ✅ JobProcessor 接口抽象

#### 接口定义

**文件**: `apps/api/src/job/job-processor.interface.ts`

**接口**:

```typescript
interface JobProcessor {
  supports(type: JobType): boolean;
  process(job: Job): Promise<{ success: boolean; result?: any; error?: string }>;
}
```

**实现**:

- `MockJobProcessor` - 当前 Mock 实现
  - 支持所有 JobType（IMAGE/VIDEO/STORYBOARD/AUDIO）
  - 模拟 1-3 秒延迟
  - 5% 随机失败率（用于测试重试）

**Processor Registry**:

- `JobProcessorRegistry` - Processor 注册表
  - 支持注册多个 Processor
  - 根据 Job.processor 字段或 JobType 查找 Processor
  - 预留真实引擎 Processor 接入点

### ✅ 进程内 Worker 实现

#### JobWorkerService

**文件**: `apps/api/src/job/job-worker.service.ts`

**功能**:

- 周期性轮询待处理任务（默认 3 秒间隔）
- 查询条件：
  - `status = PENDING`
  - `attempts < maxAttempts`
  - `scheduledAt <= now()` 或 `scheduledAt IS NULL`
  - `lockedAt IS NULL` 或 `lockedAt < 5分钟前`（锁过期）
- 按优先级和创建时间排序
- 批量处理（默认每次 5 个任务）

**生命周期**:

- `onModuleInit()` - 自动启动 Worker
- `onModuleDestroy()` - 清理定时器

**配置**:

- `JOB_WORKER_ENABLED` - 是否启用（默认 true）
- `JOB_WORKER_INTERVAL` - 轮询间隔（默认 3000ms）
- `JOB_WORKER_BATCH_SIZE` - 批量大小（默认 5）

### ✅ Job 处理流程

#### 处理逻辑（JobService.processJob）

**流程**:

1. 检查 Job 状态和重试次数
2. 检查 scheduledAt（延迟重试）
3. 加锁（lockedAt = now）并更新状态为 RUNNING
4. 调用对应 Processor 处理
5. 根据结果：
   - 成功：更新 Job 为 SUCCEEDED，更新 Shot 状态和 previewUrl
   - 失败：根据 attempts 决定重试或标记为 FAILED

**重试机制**:

- 失败后设置 `scheduledAt = now + 30秒`
- 状态回退到 `PENDING`，等待下次轮询
- 超过 `maxAttempts` 后标记为 `FAILED`

**幂等控制**:

- 通过 `lockedAt` 防止并发处理
- 锁过期时间：5 分钟

### ✅ 批量生成接入 Worker 队列

#### 批量生成逻辑调整

**变更**:

- 不再在 Controller 内部直接处理
- 改为：创建 Job（status = PENDING）→ 交由 Worker 处理
- 返回提示信息："已提交 X 个生成任务，将在后台队列中逐步处理"

**保持兼容**:

- API 接口不变
- 前端行为不变（仍可调用批量生成接口）
- 状态更新方式不变（通过轮询或手动刷新查看）

### ✅ 前端小幅增强

#### ShotEditor 组件

**增强**:

- Job 历史列表显示新字段：`attempts`, `maxAttempts`, `lastError`
- 生成按钮下方提示："任务将在后台队列中处理，请稍后刷新查看状态"

#### 导演工作台

**增强**:

- 批量生成后显示提示信息（从后端返回的 message）
- 提示："已提交 X 个镜头的生成任务，将在后台逐步处理"

### ✅ 新增/修改的主要文件

#### 后端文件

1. `packages/database/prisma/schema.prisma` - 扩展 ShotJob 模型
2. `packages/config/src/env.ts` - 添加 Worker 配置项
3. `apps/api/src/job/job-processor.interface.ts` - Processor 接口定义（新建）
4. `apps/api/src/job/job.service.ts` - 重构为队列化处理
5. `apps/api/src/job/job-worker.service.ts` - Worker 服务（新建）
6. `apps/api/src/job/job.module.ts` - 注册 JobWorkerService
7. `apps/api/src/project/project.controller.ts` - 批量生成返回提示信息
8. `apps/api/test/e2e/job-worker.e2e-spec.ts` - Worker E2E 测试（新建）

#### 前端文件

1. `apps/web/src/components/ShotEditor.tsx` - 显示重试信息、添加提示
2. `apps/web/src/app/studio/review/page.tsx` - 批量生成提示

### ✅ 当前已具备的能力

1. **队列化处理**:
   - 所有生成任务进入队列
   - Worker 异步轮询处理
   - 支持优先级排序

2. **重试机制**:
   - 失败后自动重试（最多 3 次）
   - 延迟重试（30 秒间隔）
   - 记录错误信息

3. **优先级**:
   - 支持任务优先级（数值越小优先级越高）
   - 按优先级和创建时间排序处理

4. **幂等基础**:
   - 通过 lockedAt 防止并发处理
   - 通过 attempts 控制重试次数
   - 通过状态机确保流程正确

### ⚠️ 已知限制

1. **当前仍使用 Mock Processor**:
   - 使用 `MockJobProcessor` 模拟生成
   - 后续接入真实引擎时只需实现新的 Processor 并注册

2. **进程内 Worker**:
   - 当前 Worker 运行在 API 进程内
   - TODO: 后续可拆分为独立的 `apps/workers` 应用

3. **实时进度显示**:
   - 当前不支持实时进度显示
   - TODO: 可通过 WebSocket 或 Server-Sent Events 实现

4. **查询性能**:
   - 当前使用内存过滤，大数据量时可能需要优化
   - TODO: 使用数据库原生查询优化

---

---

## 十五、第六阶段联调（Studio v0.5 – Job Dashboard & 运维面板）

**完成时间**: 2025-12-07  
**版本**: v0.5

### ✅ Job 查询与运维 API

#### 接口列表

1. **`GET /api/jobs`** - 查询 Jobs 列表（运维接口）
   - 查询参数（全部可选）:
     - `status` - JobStatus
     - `type` - JobType
     - `processor` - Processor 标识
     - `shotId` - Shot ID
     - `projectId` - Project ID（通过联表查询）
     - `from` / `to` - 时间范围（ISO date string）
     - `page` / `pageSize` - 分页参数
   - 返回内容:
     - `jobs` - Job 数组，包含核心字段和关联信息
     - `total`, `page`, `pageSize`, `totalPages` - 分页信息

2. **`POST /api/jobs/:id/retry`** - 重试单个 Job
   - Request Body: `{ resetAttempts?: boolean }`
   - 行为：将 Job 状态重置为 PENDING，保留或清零 attempts

3. **`POST /api/jobs/:id/cancel`** - 取消单个 Job
   - 行为：将 PENDING/RUNNING 状态的 Job 标记为 CANCELLED

4. **`POST /api/jobs/:id/force-fail`** - 强制失败单个 Job
   - Request Body: `{ message?: string }`
   - 行为：将 PENDING/RUNNING 状态的 Job 标记为 FAILED，写入运维备注

5. **`POST /api/jobs/batch/retry`** - 批量重试
   - Request Body: `{ jobIds: string[] }`
   - 返回：`{ succeeded, failed, total }`

6. **`POST /api/jobs/batch/cancel`** - 批量取消
   - Request Body: `{ jobIds: string[] }`
   - 返回：`{ succeeded, failed, total }`

7. **`POST /api/jobs/batch/force-fail`** - 批量强制失败
   - Request Body: `{ jobIds: string[], note?: string }`
   - 返回：`{ succeeded, failed, total }`

**实现文件**:

- `apps/api/src/job/dto/list-jobs.dto.ts` - 查询参数 DTO（新建）
- `apps/api/src/job/dto/job-operations.dto.ts` - 运维操作 DTO（新建）
- `apps/api/src/job/job.service.ts` - 新增 `listJobs`, `retryJob`, `cancelJob`, `forceFailJob`, `batchRetry`, `batchCancel`, `batchForceFail` 方法
- `apps/api/src/job/job.controller.ts` - 新增 7 个路由

**状态机约束**:

- 只允许对 PENDING/FAILED/CANCELLED 进行 retry
- RUNNING 状态的 cancel/force-fail 需要等锁过期后生效，或直接拒绝
- 运维接口不破坏 Worker 的锁定逻辑

**E2E 测试**:

- `apps/api/test/e2e/job-dashboard.e2e-spec.ts`
- 测试覆盖：查询过滤、分页、单 Job 运维、批量运维

### ✅ Job Dashboard 页面

#### 页面路径

**`/studio/jobs`**

#### 页面结构

**左侧过滤栏**（280px）:

- 状态下拉（PENDING/RUNNING/SUCCEEDED/FAILED/CANCELLED）
- 类型下拉（IMAGE/VIDEO/STORYBOARD/AUDIO）
- Processor 下拉（当前：mock）
- 时间范围选择（最近 1h / 24h / 7d / 全部）
- Shot ID 输入框
- Project ID 输入框
- 清除筛选按钮

**右侧主内容区**:

- **统计条**（顶部）:
  - Job 总数
  - 各状态数量（带颜色标签）
  - 最近 24 小时内失败数

- **批量操作栏**（选中 Jobs 时显示）:
  - 「批量重试」按钮
  - 「批量取消」按钮
  - 「批量强制失败」按钮（弹出对话框输入原因）
  - 「取消选择」按钮

- **Jobs 表格**:
  - 列：复选框、Job ID（短码，点击复制）、类型、状态、Attempts、Priority、创建时间、错误信息、关联信息、操作
  - 支持多选（checkbox）
  - 点击行展开 Job 详情面板

- **Job 详情面板**（右侧，400px）:
  - 显示 Job 全字段（id, type, status, attempts, priority, lastError）
  - 显示 payload/result 的 JSON 展示
  - 显示关联 Shot 信息（id, title, status, previewUrl）

- **分页**（底部）:
  - 显示当前页
  - 上一页/下一页按钮

#### 实现文件

- `apps/web/src/app/studio/jobs/page.tsx` - Job Dashboard 页面（新建）
- `apps/web/src/lib/apiClient.ts` - 添加 `jobApi` 方法
- `apps/web/src/components/UserInfo.tsx` - 添加「任务监控」导航链接

### ✅ 观察性与日志基础

#### JobWorkerService 日志增强

**日志记录**:

- Job 进入 RUNNING 时输出日志（包含 jobId, type, attempt）
- Job 成功/失败/最终失败时输出日志
- 使用 Nest Logger

**实现位置**:

- `apps/api/src/job/job-worker.service.ts` - 在处理完成后记录日志
- `apps/api/src/job/job.service.ts` - 在 processJob 方法中记录处理开始日志

**日志格式**:

```
[JobWorker] Processing job {jobId} ({type}), attempt {attempt}/{maxAttempts}
[JobWorker] Job {jobId} ({type}) succeeded after {attempts} attempts
[JobWorker] Job {jobId} ({type}) failed after {attempts} attempts: {error}
```

### ✅ 新增/修改的主要文件

#### 后端文件

1. `apps/api/src/job/dto/list-jobs.dto.ts` - 查询参数 DTO（新建）
2. `apps/api/src/job/dto/job-operations.dto.ts` - 运维操作 DTO（新建）
3. `apps/api/src/job/job.service.ts` - 新增查询和运维方法
4. `apps/api/src/job/job.controller.ts` - 新增 7 个路由
5. `apps/api/src/job/job-worker.service.ts` - 增加日志记录
6. `apps/api/test/e2e/job-dashboard.e2e-spec.ts` - Job Dashboard E2E 测试（新建）

#### 前端文件

1. `apps/web/src/app/studio/jobs/page.tsx` - Job Dashboard 页面（新建）
2. `apps/web/src/lib/apiClient.ts` - 添加 `jobApi` 方法
3. `apps/web/src/components/UserInfo.tsx` - 添加导航链接
4. `apps/web/e2e/smoke.spec.ts` - 添加 Job Dashboard E2E 测试用例

### ✅ 当前已具备的能力

1. **Job 查询与过滤**:
   - 支持多维度过滤（状态、类型、Processor、项目、时间范围）
   - 支持分页查询
   - 返回关联信息（Shot、Project）

2. **单 Job 运维**:
   - 重试（重置为 PENDING）
   - 取消（标记为 CANCELLED）
   - 强制失败（标记为 FAILED，写入备注）

3. **批量运维**:
   - 批量重试
   - 批量取消
   - 批量强制失败

4. **可视化监控**:
   - Job Dashboard 页面
   - 统计视图（总数、各状态数量、失败数）
   - Job 详情查看

5. **日志基础**:
   - Worker 处理日志
   - Job 状态变更日志

### ⚠️ 已知限制

1. **当前仍使用 Mock Processor**:
   - 使用 `MockJobProcessor` 模拟生成
   - 后续接入真实引擎时只需实现新的 Processor 并注册到 Registry
   - Processor 接口位置：`apps/api/src/job/job-processor.interface.ts`
   - 实现示例：`apps/api/src/job/job.service.ts` 中的 `MockJobProcessor` 类

2. **实时进度显示**:
   - 当前不支持实时进度显示
   - TODO: 可通过 WebSocket 或 Server-Sent Events 实现

3. **日志聚合**:
   - 当前使用基础 console.log 和 Nest Logger
   - TODO: 接入 ObservabilityModule 或外部日志系统（如 ELK Stack）

---

---

## 十六、第七阶段改造（Studio v0.6 – EngineAdapter v1 / 真实引擎接入骨架）

**完成时间**: 2025-12-07  
**版本**: v0.6

### ✅ 扩展 Job / Shot 的引擎元信息

#### ShotJob 模型扩展

**新增字段**:

- `engine` (String, default: "mock") - 目标引擎标识
  - `"mock"` - 模拟引擎（默认）
  - `"real-http"` - 真实 HTTP 引擎骨架
  - 预留：`"novel2video-image-v1"`, `"novel2video-video-v1"` 等
- `engineConfig` (Json?) - 引擎配置（分辨率、风格 preset 等）
- `engineRequestId` (String?) - 真实引擎返回的请求 ID（便于排查问题）

#### Shot 模型扩展

**新增字段**:

- `preferredEngine` (String?) - 引擎偏好（如不设置则用默认引擎）

**数据库迁移**:

- 执行 `pnpm db:generate` + `pnpm db:push`
- 已有数据不崩溃（engine 默认值为 "mock"）

### ✅ EngineAdapter 抽象

#### 接口定义

**文件**: `apps/api/src/engine/engine-adapter.interface.ts`

**接口**:

```typescript
interface EngineAdapter {
  readonly name: string;
  supports(type: JobType): boolean;
  execute(request: EngineRequest): Promise<EngineResult>;
}
```

**EngineRequest**:

- `jobId` - Job ID
- `type` - JobType
- `payload` - 请求参数
- `engineConfig` - 引擎配置

**EngineResult**:

- `success` - 是否成功
- `previewUrl` - 预览 URL
- `fileUrl` - 文件 URL
- `rawResult` - 原始引擎返回结果
- `errorMessage` - 错误信息
- `engineRequestId` - 引擎请求 ID

#### EngineRegistry

**文件**: `apps/api/src/engine/engine-registry.service.ts`

**功能**:

- 注册引擎适配器
- 根据引擎名称查找适配器
- 支持回退到默认引擎
- 获取所有已注册的引擎名称

### ✅ MockEngineAdapter

#### 实现

**文件**: `apps/api/src/engine/adapters/mock-engine.adapter.ts`

**功能**:

- 实现 `EngineAdapter` 接口
- `name = "mock"`
- 支持所有 JobType（IMAGE/VIDEO/STORYBOARD/AUDIO）
- `execute()`:
  - 延迟 1-3 秒
  - 5% 随机失败率（用于测试重试）
  - 返回模拟结果（previewUrl, fileUrl, rawResult）

### ✅ HttpEngineAdapter 骨架

#### 实现

**文件**: `apps/api/src/engine/adapters/http-engine.adapter.ts`

**功能**:

- 实现 `EngineAdapter` 接口
- `name = "real-http"`
- 支持 IMAGE 和 VIDEO 类型
- `execute()`:
  - 当前为占位实现，返回固定成功结果
  - 保留完整调用链结构（构造 HTTP 请求 → 处理响应 → 转成 EngineResult）
  - 所有错误都 catch，并填充 errorMessage
  - TODO: 后续接入真实引擎时，只需替换 `execute()` 方法的内部逻辑

**占位实现示例**:

```typescript
// 当前：模拟 HTTP 调用延迟，返回固定成功结果
// 后续：实现真实 HTTP 调用
const response = await fetch(`${this.baseUrl}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId, type, payload, config }),
});
```

### ✅ JobProcessor 重构

#### 调整逻辑

**变更**:

- 保留 `JobProcessor` 接口（向后兼容）
- `JobService.processJob()` 内部逻辑调整：
  - 根据 `Job.engine` 字段，向 `EngineRegistry` 请求对应 `EngineAdapter`
  - 构造 `EngineRequest`（带 jobId/type/payload/engineConfig）
  - 调用 `adapter.execute()`
  - 根据 `EngineResult` 更新 Job 和 Shot

**调用链**:

```
Job (engine="mock" or "real-http")
  → EngineRegistry.findAdapter(engine)
  → EngineAdapter.execute(request)
  → EngineResult
  → 更新 Job.status/result/engineRequestId
  → 更新 Shot.status/previewUrl
```

### ✅ Job 创建逻辑与 Engine 绑定

#### API 层变更

**CreateJobDto 扩展**:

- `engine?: string` - 引擎标识（可选）
- `engineConfig?: Record<string, any>` - 引擎配置（可选）

**Job 创建逻辑**:

- 优先级：请求指定 > Shot 偏好 > 默认配置
- 创建 Job 时写入 `engine` 和 `engineConfig` 字段

**批量生成支持**:

- `POST /api/projects/shots/batch/generate` 支持 `engine` 和 `engineConfig` 参数

### ✅ 前端可选增强

#### ShotEditor 组件

**增强**:

- 增加引擎选择下拉框：
  - 选项：Mock（模拟）/ Real HTTP（真实引擎骨架）
  - 默认值：`"mock"`
- 发起生成时，把选中的 `engine` 一并传给创建 Job 的 API

#### 导演工作台

**增强**:

- 批量生成支持引擎选择（可选，当前保持默认行为）

### ✅ 配置项

#### 环境变量

**新增配置**:

- `ENGINE_DEFAULT` - 默认使用的引擎（默认：`"mock"`）
- `ENGINE_REAL_HTTP_BASE_URL` - 真实 HTTP 引擎基础 URL（默认：`"http://localhost:8000"`）

**配置位置**:

- `packages/config/src/env.ts`

### ✅ 新增/修改的主要文件

#### 后端文件

1. `packages/database/prisma/schema.prisma` - 扩展 ShotJob 和 Shot 模型
2. `packages/config/src/env.ts` - 添加引擎配置项
3. `apps/api/src/engine/engine-adapter.interface.ts` - EngineAdapter 接口定义（新建）
4. `apps/api/src/engine/engine-registry.service.ts` - EngineRegistry 服务（新建）
5. `apps/api/src/engine/adapters/mock-engine.adapter.ts` - MockEngineAdapter（新建）
6. `apps/api/src/engine/adapters/http-engine.adapter.ts` - HttpEngineAdapter 骨架（新建）
7. `apps/api/src/job/job.service.ts` - 重构为使用 EngineAdapter
8. `apps/api/src/job/job.module.ts` - 注册 EngineRegistry 和适配器
9. `apps/api/src/job/dto/create-job.dto.ts` - 添加 engine 和 engineConfig 字段
10. `apps/api/src/project/project.controller.ts` - 批量生成支持 engine 参数
11. `apps/api/test/unit/engine-registry.spec.ts` - EngineRegistry 单元测试（新建）
12. `apps/api/test/e2e/engine-adapter.e2e-spec.ts` - EngineAdapter E2E 测试（新建）

#### 前端文件

1. `apps/web/src/components/ShotEditor.tsx` - 添加引擎选择下拉框
2. `apps/web/src/lib/apiClient.ts` - createJob 支持 engine 参数

### ✅ Job → EngineAdapter → Result → Shot 完整调用链

1. **创建 Job**:
   - 调用 `POST /api/shots/:shotId/jobs` 或批量生成接口
   - 指定 `engine`（可选，默认使用 `ENGINE_DEFAULT`）
   - 创建 Job 记录（`engine`, `engineConfig` 字段）

2. **Worker 轮询**:
   - Worker 发现 PENDING 状态的 Job
   - 调用 `JobService.processJob(jobId)`

3. **EngineAdapter 选择**:
   - `JobService.processJob()` 根据 `Job.engine` 字段
   - 调用 `EngineRegistry.findAdapter(engine)`
   - 获取对应的 `EngineAdapter`（MockEngineAdapter 或 HttpEngineAdapter）

4. **执行引擎请求**:
   - 构造 `EngineRequest`（jobId, type, payload, engineConfig）
   - 调用 `adapter.execute(request)`
   - 返回 `EngineResult`

5. **更新 Job 和 Shot**:
   - 根据 `EngineResult.success`：
     - 成功：更新 Job 为 SUCCEEDED，写入 result/engineRequestId，更新 Shot.status/previewUrl
     - 失败：按重试逻辑处理（attempts/maxAttempts/lastError）

### ✅ 当前已具备的能力

1. **EngineAdapter 抽象**:
   - 统一不同引擎的调用方式
   - 支持注册多个引擎适配器
   - 支持回退到默认引擎

2. **MockEngineAdapter**:
   - 模拟引擎（用于开发和测试）
   - 支持所有 JobType
   - 5% 随机失败率（用于测试重试）

3. **HttpEngineAdapter 骨架**:
   - 真实 HTTP 引擎适配器骨架（占位实现）
   - 保留完整调用链结构
   - 后续接入真实引擎时只需替换 `execute()` 方法

4. **配置化引擎选择**:
   - 通过环境变量配置默认引擎
   - 通过 API 请求指定引擎
   - 通过前端选择引擎

### ⚠️ 已知限制

1. **HttpEngineAdapter 当前为占位实现**:
   - 不直接调用真实外部服务
   - 返回固定成功结果
   - 后续接入真实引擎时，只需替换 `execute()` 方法的内部逻辑

2. **接入真实引擎的步骤**:
   - 实现新的 `EngineAdapter`（参考 `HttpEngineAdapter`）
   - 在 `JobModule` 中注册新适配器
   - 在 `HttpEngineAdapter.execute()` 中实现真实 HTTP 调用逻辑
   - 更新 `ENGINE_REAL_HTTP_BASE_URL` 配置

3. **Processor 位置**:
   - EngineAdapter 接口：`apps/api/src/engine/engine-adapter.interface.ts`
   - MockEngineAdapter：`apps/api/src/engine/adapters/mock-engine.adapter.ts`
   - HttpEngineAdapter：`apps/api/src/engine/adapters/http-engine.adapter.ts`
   - 注册位置：`apps/api/src/job/job.module.ts` 的 `ENGINE_ADAPTERS` provider

---

**报告生成时间**: 2025-12-07  
**报告版本**: 7.0 (Studio v0.6)  
**状态**: ✅ 第七阶段改造完成，EngineAdapter v1 可用（引擎抽象、Mock/Real 适配器、配置化引擎选择）
