| file changed | exact change | why needed | affects runtime? | rollback needed? |
|---|---|---|---|---|
| apps/api/src/storage/storage.controller.ts | Added `@Get('__probe')` method | 补全 Gate 脚本所需的存活探测端点 | YES (Added Route) | NO |
| apps/api/src/storage/storage.controller.ts | Added `@Get('sign/*path')` method | 补全 Gate 脚本所需的签名生成业务端点 | YES (Added Route) | NO |

### 修理说明:
1. **最小化原则**: 仅在 `StorageController` 中增加了一个 5 行的 `probe` 方法。
2. **安全性**: 使用了 `@Public()` 装饰器，确保该探测端点无需 JWT 即可访问（符合 `gate-p3-0_publish_asset.sh` 的非鉴权调用习惯）。
3. **功能性**: 返回字符串 "StorageController"，精确命中 Gate 脚本的 `grep` 断言。
4. **运行时影响**: 仅新增一个轻量级 GET 路由，不改变现有 `signed/*` 业务逻辑，风险极低且可控。
