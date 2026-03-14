| file changed | exact change | why needed | affects runtime? | rollback needed? |
|---|---|---|---|---|
| apps/api/src/storage/storage.controller.ts | `@Get('signed/*path')` -> `@Get('signed/:path*')` -> `@Get('signed/*path')` | 回滚通配符语法至合法的 Nest 11 规范 | YES (Routing Syntax) | NO |
| apps/api/src/storage/storage.controller.ts | `stream.pipe(res)` -> `res.sendFile(absPath)` | 利用 Express 内置能力自动支持 HTTP Range (206) | YES (Streaming Logic) | NO |
| apps/api/src/storage/storage.controller.ts | 添加 `normalizeStorageKey` 并应用 | 修复 `path-to-regexp` v8 将 `*path` 解析为数组引发的 `.toString()` 逗号分隔 BUG，确保文件系统映射不失真 | YES (Path Resolution) | NO |

### 修理说明 (PHASE 8 & 8R 全集):
1. **语法回滚与统一**: `#6` 合并入阶段，NestJS 11 对 `path-to-regexp` 的底层升级导致通配符必须书写为 `*path`，不能使用 `:path*`，否则会引发 `Unsupported route path` 并阻断 API 服务启动。
2. **通配符反序列化大坑 (404 盲点)**: 即使用合法的 `*path`，匹配到的 `@Param('path') key` 其实是一个字符串数组（如 `['temp', 'gates', '123.txt']`）。如果不经劫持，JS 会将其隐式转为逗号分隔的字符串，不仅破坏生成的签名 URL，更导致 `exists()` 永远找错文件。引人 `normalizeStorageKey` 确保无论输入何种反人类结构，均规范为标准的相对路径串。
3. **Range 206 支持**: 手动管道流式输出不具备 Range 头解析能力。切换到 `res.sendFile` 后，Node 原生接管了 206 分片能力。
