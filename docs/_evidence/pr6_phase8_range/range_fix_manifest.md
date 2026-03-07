| file changed | exact change | why needed | affects runtime? | rollback needed? |
|---|---|---|---|---|
| apps/api/src/storage/storage.controller.ts | `@Get('signed/*path')` -> `@Get('signed/:path*')` | 兼容 NestJS 11 / PTRv8 捕获逻辑，修复 `undefined` key 导致的 404 | YES (Routing Syntax) | NO |
| apps/api/src/storage/storage.controller.ts | `stream.pipe(res)` -> `res.sendFile(absPath)` | 利用 Express 内置能力自动支持 HTTP Range (206) | YES (Streaming Logic) | NO |

### 修理说明:
1. **路由捕获修复**: 在 NestJS 11 环境下，旧的通配符语法无法正确映射到 `@Param('path')`。切换为 `:path*` 确保了全路径 key 的完整捕获。
2. **Range 206 支持**: 手动管道流式输出不具备 Range 头解析能力。`res.sendFile` 是 Express 推荐的生产级静态文件分发方案，能自动处理分片读取请求。
3. **安全性**: 维持了现有的 `SignedUrlService.verifySignedUrl` 校验逻辑，仅改变了校验通过后的分发实现。
