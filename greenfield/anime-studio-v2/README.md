# Anime Studio V2

全新隔离的绿地项目，用于重建“小说 → 动漫剧本 → 分镜 → 审校”的平台基础。

## 目标

- 不依赖旧系统内部实现
- 从最小闭环重新搭建
- 先打通上游控制层，再接视频执行层

## 当前包含

- `apps/api`：全新 API 骨架
- `apps/web`：全新 Web 骨架
- `packages/domain`：领域模型与 DTO

## 当前实现的最小闭环

1. 创建项目
2. 导入小说文本
3. 生成单集大纲
4. 生成分场剧本
5. 生成分镜脚本
6. 运行增强一致性审校
7. 记录关键版本时间线
8. 准备视频模型可接入的预演交付包
9. 提交标准化出片任务
10. 支持大体量小说分片导入与素材资产库
11. 支持真实文件上传与导入任务

## 目录

- `apps/api/src/server.ts`：API 启动入口
- `apps/api/src/routes.ts`：第一批接口
- `apps/api/src/store.ts`：内存态项目仓库
- `apps/api/src/pipeline.ts`：最小生成流水线
- `apps/api/src/versioning.ts`：项目版本留痕
- `apps/api/src/preview-video.ts`：预演视频交付包接缝
- `apps/api/src/render-video.ts`：出片 Provider 适配层
- `apps/api/src/project-state.ts`：统一的项目衍生内容清理规则
- `packages/domain/src/index.ts`：领域类型

## 启动建议

后续接入正式数据库前，先用内存态验证流程和结构。

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

当前数据库默认连接：

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anime_studio_v2?schema=public`
- `ANIME_STUDIO_V2_REPOSITORY=file`
- `ANIME_STUDIO_V2_STORE_PATH=greenfield/anime-studio-v2/.runtime/projects.json`
- `ANIME_STUDIO_V2_BODY_LIMIT=64mb`
- `ANIME_STUDIO_V2_FILE_STORAGE_PATH=greenfield/anime-studio-v2/.runtime/storage`

## 当前持久化模式

- 默认使用 `file repository`
- 项目数据会落到 `greenfield/anime-studio-v2/.runtime/projects.json`
- 后续会将该仓储替换为 Prisma/PostgreSQL 实现，API 不改

当前一致性审校已覆盖：

1. 主角开场/尾场在场
2. 开场事件钩子强度
3. 尾场悬念强度
4. 分场数量与镜头密度
5. 场景重复与冲突重复风险
6. 人工复核场次覆盖

当前预演交付包会输出：

1. 视频模型提示词包
2. 分镜预演清单
3. 机位与镜头计划
4. 中高风险问题提醒

当前出片任务层支持：

1. `mock_video` 联调直出
2. `sora` 占位提交适配
3. `jimeng` 占位提交适配
4. 渲染任务留痕与产物登记

当前长文本与资产层支持：

1. 分片上传会话创建、续传、组装导入
2. 长篇小说前端自动切片上传
3. 素材资产库登记（角色/场景/道具/风格）
4. 上游内容变化时自动清理失效整包、预演和出片任务

当前真实文件链路支持：

1. 本地文件存储（小说源文件 / 素材附件）
2. 从已上传源文件创建导入任务
3. 导入任务完成后直接进入小说分析链路

## 验证命令

```bash
cd greenfield/anime-studio-v2
pnpm typecheck
pnpm smoke
```
