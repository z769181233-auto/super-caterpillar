# 存储路径权威规则

## 规则概述

为确保 API 和 Worker 使用相同的存储路径，避免文件访问不一致问题，项目采用统一的路径权威规则。

---

## 路径计算规则

### 优先级顺序

1. **REPO_ROOT 环境变量**（推荐）
   - 如果设置了 `REPO_ROOT`，存储路径为：`${REPO_ROOT}/.data/storage`
   - 这是**推荐方式**，确保 API 和 Worker 使用相同路径

2. **STORAGE_ROOT 环境变量**（覆盖）
   - 如果设置了 `STORAGE_ROOT`，直接使用该路径
   - 仅在需要自定义存储位置时使用
   - **注意**：如果同时设置了 `REPO_ROOT` 和 `STORAGE_ROOT`，`REPO_ROOT` 优先级更高

3. **兜底规则**（不推荐）
   - 如果两者都未设置，使用 `process.cwd()` 推导
   - API：从 `apps/api` 向上两级到项目根目录
   - Worker：从 `apps/workers` 向上两级到项目根目录
   - **警告**：这种方式可能导致路径不一致，不推荐在生产环境使用

---

## 配置方式

### 方式 1：设置 REPO_ROOT（推荐）

在 `.env.local` 或环境变量中设置：

```bash
export REPO_ROOT="/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar"
```

或使用绝对路径：

```bash
export REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
```

### 方式 2：设置 STORAGE_ROOT（覆盖）

仅在需要自定义存储位置时使用：

```bash
export STORAGE_ROOT="/custom/storage/path"
```

---

## 实现位置

### API 端

- **文件**: `apps/api/src/storage/local-storage.service.ts`
- **逻辑**: 优先使用 `REPO_ROOT`，其次 `STORAGE_ROOT`，最后兜底

### Worker 端

- **文件**: `apps/workers/src/video-render.processor.ts`
- **逻辑**: 与 API 端完全一致

---

## 验证方法

### 1. 检查 API 初始化日志

启动 API 后，查看日志中的：

```
[LocalStorageAdapter] Initialized at: <path>
```

确认路径是否正确。

### 2. 检查 Worker 初始化日志

启动 Worker 后，查看日志中的：

```
[LocalStorageAdapter] Initialized at: <path>
```

确认路径与 API 一致。

### 3. 验证文件访问

```bash
# 测试视频文件访问
curl -I http://localhost:3000/api/storage/videos/{videoKey}

# 期望结果：HTTP 200 OK, Content-Type: video/mp4
```

---

## 常见问题

### Q: 为什么 API 返回 404，但文件在磁盘上存在？

**A**: 通常是因为 API 和 Worker 使用了不同的存储路径。解决方式：
1. 设置 `REPO_ROOT` 环境变量
2. 确保 API 和 Worker 使用相同的环境变量

### Q: 生产环境如何配置？

**A**: 推荐方式：
1. 在部署配置中设置 `REPO_ROOT` 为项目根目录的绝对路径
2. 或在 Docker 容器中设置 `REPO_ROOT=/app`（假设项目在 `/app`）

### Q: 可以同时设置 REPO_ROOT 和 STORAGE_ROOT 吗？

**A**: 可以，但 `REPO_ROOT` 优先级更高。如果设置了 `REPO_ROOT`，`STORAGE_ROOT` 会被忽略。

---

## 调试

### 启用调试日志

设置环境变量：

```bash
export STORAGE_DEBUG="true"
```

或

```bash
export NODE_ENV="development"
```

调试日志会输出：
- Storage key
- Storage root path
- Full file path
- File existence check result

---

## 相关文件

- `apps/api/src/storage/local-storage.service.ts` - API Storage Service
- `apps/workers/src/video-render.processor.ts` - Worker Video Processor
- `apps/api/src/storage/storage.controller.ts` - Storage API Controller
- `.env.example` - 环境变量示例

---

**最后更新**: 2024-12-18

