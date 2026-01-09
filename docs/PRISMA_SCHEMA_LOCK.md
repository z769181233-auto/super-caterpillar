# Prisma Schema 锁定文档

## 锁定原则

1. **禁止随意修改**：未经「显式指令」，禁止增删模型和字段。
2. **只允许的修改**：
   - 补充索引（@@index）
   - 添加默认值（@default）
   - 添加审计字段（如 createdAt, updatedAt）
   - 所有修改必须配套 migration
3. **修改流程**：
   - 先更新本文档
   - 再修改 schema.prisma
   - 创建 migration
   - 运行 migration

## 核心模型字段列表

### Task（平台级任务）

- `id`: String (UUID)
- `organizationId`: String? (组织ID)
- `userId`: String? (用户ID)
- `apiKeyId`: String? (API Key ID)
- `type`: TaskType (任务类型)
- `status`: TaskStatus (任务状态: PENDING/RUNNING/SUCCEEDED/FAILED/RETRYING/CANCELLED)
- `payload`: Json (任务载荷)
- `errorMessage`: String? (错误信息)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### ShotJob（Worker 执行单元）

- `id`: String (UUID)
- `organizationId`: String? (组织ID)
- `projectId`: String? (项目ID)
- `episodeId`: String? (Episode ID)
- `sceneId`: String? (Scene ID)
- `shotId`: String? (Shot ID)
- `workerId`: String? (Worker ID)
- `taskId`: String? (Task ID)
- `status`: JobStatus (Job状态)
- `type`: JobType (Job类型)
- `priority`: Int (优先级)
- `maxRetry`: Int (最大重试次数)
- `retryCount`: Int (已重试次数)
- `payload`: Json (Job载荷)
- `engineConfig`: Json (引擎配置)
- `lastError`: String? (最后错误)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Project（项目）

- `id`: String (UUID)
- `name`: String (项目名称)
- `description`: String? (描述)
- `ownerId`: String (所有者ID)
- `organizationId`: String (组织ID)
- `status`: ProjectStatus (项目状态)
- `metadata`: Json? (元数据)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Episode（集）

- `id`: String (UUID)
- `seasonId`: String? (Season ID)
- `projectId`: String? (Project ID，向后兼容)
- `index`: Int (序号)
- `name`: String (名称)
- `summary`: String? (简介)
- `chapterId`: String? (章节ID，源数据映射)

### Scene（场景）

- `id`: String (UUID)
- `episodeId`: String (Episode ID)
- `index`: Int (序号)
- `title`: String (标题)
- `summary`: String? (简介)

### Shot（镜头）

- `id`: String (UUID)
- `sceneId`: String (Scene ID)
- `index`: Int (序号)
- `title`: String? (标题)
- `description`: String? (描述)
- `type`: String (类型)
- `params`: Json (参数)
- `qualityScore`: Json (质量分数)
- `reviewedAt`: DateTime? (审核时间)
- `durationSeconds`: Int? (时长秒数)

## 枚举锁定

### TaskStatus

- PENDING
- RUNNING
- SUCCEEDED
- FAILED
- RETRYING
- CANCELLED

**注意**：已删除 `SUCCESS`，统一使用 `SUCCEEDED`。

### JobStatus

- PENDING
- DISPATCHED
- RUNNING
- SUCCEEDED
- FAILED
- CANCELLED

### WorkerStatus

- online
- idle
- busy
- offline
