# 存储分发架构文档

## 概述

本文档描述存储分发架构，包括本地存储和未来对象存储迁移策略。

## 架构设计

### 当前架构（本地存储 + Nginx 直出）

```
Client Request
    ↓
API Server (验证签名 + 权限)
    ↓
X-Accel-Redirect: /protected_storage/<key>
    ↓
Nginx (内部跳转，直出文件)
    ↓
Local File System
```

### 核心组件

1. **API Server**: 负责签名生成、权限验证
2. **Nginx**: 负责文件直出，支持 Range 请求
3. **Local Storage**: 本地文件系统存储

## Nginx 配置

### 基础配置

```nginx
# 内部 location，仅允许 X-Accel-Redirect 访问
location /protected_storage/ {
    internal;  # 只允许内部跳转，禁止外部直接访问
    
    alias /path/to/storage/;  # 存储根目录
    
    # 支持 Range 请求（视频播放必需）
    add_header Accept-Ranges bytes;
    
    # 禁用缓冲，支持流式传输
    proxy_buffering off;
    
    # 设置超时
    proxy_read_timeout 300s;
    proxy_connect_timeout 10s;
}

# API 端点（验证签名后返回 X-Accel-Redirect）
location /api/storage/signed/ {
    proxy_pass http://api:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### Docker Compose 示例

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./storage:/var/storage:ro  # 只读挂载存储目录
    ports:
      - "80:80"
    depends_on:
      - api
    networks:
      - app-network

  api:
    build: ./apps/api
    environment:
      - STORAGE_ACCEL_REDIRECT_ENABLED=true
      - STORAGE_ROOT=/var/storage
    volumes:
      - ./storage:/var/storage:rw  # API 需要读写权限
    networks:
      - app-network
```

### 完整 Nginx 配置示例

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3000;
    }

    # 存储直出（内部 location）
    location /protected_storage/ {
        internal;
        alias /var/storage/;
        
        # 支持 Range 请求
        add_header Accept-Ranges bytes;
        
        # 禁用缓冲
        proxy_buffering off;
        
        # 超时设置
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        
        # 日志
        access_log /var/log/nginx/storage_access.log;
    }

    # API 代理
    location /api/ {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 健康检查
    location /health {
        proxy_pass http://api;
    }
}
```

## 签名 URL 流程

### 1. 生成签名 URL

```http
GET /api/storage/sign/videos/job-123.mp4
Authorization: Bearer <token>

Response:
{
  "url": "/api/storage/signed/videos/job-123.mp4?expires=1234567890&tenantId=org-123&userId=user-456&signature=xxx",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

### 2. 访问签名 URL

```http
GET /api/storage/signed/videos/job-123.mp4?expires=1234567890&tenantId=org-123&userId=user-456&signature=xxx

Response Headers:
X-Accel-Redirect: /protected_storage/videos/job-123.mp4
Content-Type: video/mp4
Accept-Ranges: bytes
```

### 3. Nginx 处理

Nginx 接收到 `X-Accel-Redirect` 后，内部跳转到 `/protected_storage/` location，直接输出文件。

## 权限验证

### RBAC 检查

1. **签名生成时**: 验证用户是否有权限访问资源
2. **签名验证时**: 验证签名包含的 tenantId + userId
3. **访问时**: 再次验证权限（双重检查）

### 权限模型

- 资源（Asset）关联到 Project
- Project 关联到 Organization（tenantId）
- 用户必须是 Organization 成员或 Project 所有者

## Range 请求支持

视频播放器需要 Range 请求支持，Nginx 配置已包含：

```nginx
add_header Accept-Ranges bytes;
```

Nginx 会自动处理 Range 请求，返回 206 Partial Content。

## 安全特性

### 1. 防盗链

- 签名包含 tenantId + userId
- 访问前验证权限
- 越权访问统一返回 404（防枚举）

### 2. 签名验证

- HMAC-SHA256 签名
- 包含过期时间
- 时序安全比较

### 3. 路径安全

- 禁止路径遍历（`..`）
- 禁止绝对路径（`/` 开头）

## 未来迁移：对象存储

### 迁移策略

当迁移到对象存储（如 S3、OSS）时，架构调整为：

```
Client Request
    ↓
API Server (验证签名 + 权限)
    ↓
生成预签名 URL（对象存储 SDK）
    ↓
返回预签名 URL 给客户端
    ↓
客户端直接访问对象存储
```

### 实现要点

1. **抽象存储接口**: 创建 `StorageAdapter` 接口
2. **本地实现**: `LocalStorageAdapter`（当前）
3. **对象存储实现**: `ObjectStorageAdapter`（未来）
4. **统一 API**: 保持 API 接口不变

### 代码结构

```typescript
interface StorageAdapter {
  generateSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  getReadStream(key: string): ReadableStream;
  exists(key: string): Promise<boolean>;
}

class LocalStorageAdapter implements StorageAdapter {
  // 当前实现：Nginx X-Accel-Redirect
}

class S3StorageAdapter implements StorageAdapter {
  // 未来实现：S3 预签名 URL
  async generateSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    return s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: options.expiresIn,
    });
  }
}
```

### 迁移步骤

1. **阶段 1**: 实现对象存储适配器
2. **阶段 2**: 通过环境变量切换适配器
3. **阶段 3**: 数据迁移（可选）
4. **阶段 4**: 完全切换到对象存储

## Feature Flags

### 环境变量

- `STORAGE_ACCEL_REDIRECT_ENABLED=true`: 启用 Nginx 直出（默认）
- `STORAGE_ACCEL_REDIRECT_ENABLED=false`: 回退到 API 直出（仅回滚场景）

### 回滚方案

如果 Nginx 直出出现问题，可以快速回滚：

```bash
# 1. 修改环境变量
export STORAGE_ACCEL_REDIRECT_ENABLED=false

# 2. 重启 API
docker-compose restart api
```

## 监控与日志

### Nginx 日志

```nginx
access_log /var/log/nginx/storage_access.log;
```

### API 日志

- 签名生成: `[Storage] Generated signed URL`
- 权限验证: `[StorageAuth] Access granted/denied`
- 签名验证失败: `[Storage] Invalid signed URL attempt`

## 性能优化

### 1. Nginx 缓存（可选）

对于静态资源，可以启用缓存：

```nginx
location /protected_storage/ {
    # ... 其他配置 ...
    
    # 缓存配置
    expires 1h;
    add_header Cache-Control "public, immutable";
}
```

### 2. CDN 集成（未来）

对象存储迁移后，可以集成 CDN 进一步加速。

## 故障排查

### 问题 1: X-Accel-Redirect 不工作

**检查项**:
- Nginx 配置中 `internal` 指令是否正确
- 存储路径是否正确
- 文件权限是否正确

### 问题 2: Range 请求失败

**检查项**:
- Nginx 配置中 `Accept-Ranges` 头是否正确
- 文件是否存在且可读

### 问题 3: 权限验证失败

**检查项**:
- 签名中的 tenantId + userId 是否正确
- Asset 表中的 organizationId 是否正确
- 用户是否是组织成员

## 参考

- [Nginx X-Accel-Redirect](https://nginx.org/en/docs/http/ngx_http_core_module.html#internal)
- [Nginx Range 请求支持](https://nginx.org/en/docs/http/ngx_http_core_module.html#max_ranges)

