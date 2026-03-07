| item | value |
|---|---|
| failing request | `GET /api/storage/signed/novels/...` (with `Range` header) |
| exact file implicated | `apps/api/src/storage/storage.controller.ts` |
| exact method implicated | `serveSigned` |
| first real cause | **NestJS 11 / PTRv8 路由匹配语法变动** |
| category | routing / stream-range |
| minimal fix side | API (Controller) |

### 根因判定:
**核心首因**: 路由装饰器 `@Get('signed/*path')` 在 NestJS 11 下失效。
在 `path-to-regexp` v8 中，通配符参数必须使用 `:name*` 语法才能被 `@Param` 正确捕获。当前写法导致 `key` 变量为 `undefined`，进而触发 `FILE_NOT_FOUND` (404)。

**衍生次因**: 即便修复路由，原有的 `stream.pipe(res)` 亦不支持 HTTP 206 语义。
必须切换到 Express 原生的 `res.sendFile` 或实现 Range 分片读取逻辑。
