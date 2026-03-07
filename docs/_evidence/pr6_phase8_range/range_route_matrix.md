| item | value |
|---|---|
| generated signed url pattern | `/api/storage/signed/{safePathKey}?expires=...&signature=...` |
| request method | GET |
| target controller | `StorageController` |
| target handler | `serveSigned` |
| wildcard path captured? | **NO** (Current `*path` syntax in Nest 11 returns `undefined`) |
| query string preserved? | YES |
| range header observed? | YES (Gate sends `Range: bytes=0-10`) |
| 404 happens before file streaming? | **YES** (Likely due to path capture failure or `exists(undefined)` check) |

### 行为分析:
1. **通配符失效**: NestJS 11 使用 `path-to-regexp` v8，旧的 `*path` 写法不再能被 `@Param('path')` 识别，导致 `key` 为 `undefined`。
2. **状态冲突**: `localStorageService.exists(undefined)` 触发 404 返回。
3. **能力缺失**: 即便路由匹配成功，当前的 `fs.createReadStream().pipe(res)` 也不支持 HTTP Range，无法返回 206。
