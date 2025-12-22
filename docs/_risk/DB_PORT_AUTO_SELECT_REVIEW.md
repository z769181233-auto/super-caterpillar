# 数据库端口自动选择功能 - REVIEW 报告

## 模式声明
**MODE: REVIEW** - 只做验证与审查，不写新代码

## 目标
验证数据库启动脚本的端口自动选择功能是否符合"商业级 0 雷区"标准：
1. 端口自动选择（5432 → 5433 → 5434 → 15432 → 25432）
2. 坏容器自动检测与修复（Created 状态 + 端口绑定失败）
3. 自动更新 .env.local 中的 DATABASE_URL 端口
4. .env.local 更新幂等性（仅替换端口，不破坏其他字段）

## 执行内容

### 变更文件清单
1. **`tools/env/set-database-url-port.js`**（新建）
   - 安全更新 .env.local 中的 DATABASE_URL 端口
   
2. **`tools/db/up-postgres.sh`**（修改）
   - 端口自动选择逻辑
   - 坏容器检测与修复
   - 自动更新 .env.local
   
3. **`package.json`**（修改）
   - 新增 `"db:status"` 脚本

4. **`tools/db/wait-postgres.js`**（无需修改）
   - 已从 DATABASE_URL 解析端口，无硬编码 ✅

## 验证方式

### 1) 变更范围审计
```bash
git status --short
git diff --name-only | grep -E "(tools/db|tools/env|package.json)"
```

### 2) 静态语法验证
```bash
node -c tools/env/set-database-url-port.js
bash -n tools/db/up-postgres.sh
```

### 3) 行为验证
```bash
pnpm db:status  # 检查当前容器状态
pnpm db:up      # 测试端口自动选择
pnpm db:status  # 验证容器状态
```

### 4) .env.local 更新幂等性验证
- 测试脚本更新端口前后，其他字段是否保持不变
- 验证 URL 解析和构建逻辑正确性

### 5) wait-postgres.js 端口解析验证
- 确认从 DATABASE_URL 解析，无硬编码

### 6) 端到端验证
- 验证 migrate/push 是否能正常运行

## 验证结果

### ✅ 通过项

#### 1. 静态语法验证
- ✅ `set-database-url-port.js` 语法正确
- ✅ `up-postgres.sh` 语法正确

#### 2. 变更范围
- ✅ 仅修改计划内文件：
  - `tools/env/set-database-url-port.js`（新建）
  - `tools/db/up-postgres.sh`（修改）
  - `package.json`（修改）

#### 3. wait-postgres.js 端口解析
- ✅ 从 `DATABASE_URL` 解析端口：`parseDatabaseUrl(DATABASE_URL)`
- ✅ 无硬编码端口值
- ✅ 解析逻辑：`port: parseInt(parsed.port || '5432', 10)`

#### 4. .env.local 更新幂等性
- ✅ 实际测试：端口从 5432 更新到 5433
- ✅ 其他行未改变（验证通过）
- ✅ URL 构建正确：仅替换端口，保留 user/password/host/database/query

#### 5. 端口选择逻辑
- ✅ 端口候选列表：`PORT_CANDIDATES=(5432 5433 5434 15432 25432)`
- ✅ 可用性检测函数：`is_port_available()` 实现完整
- ✅ 检测策略：优先 lsof → 回退 nc → 无法检测时让 docker run 验证

#### 6. 坏容器检测逻辑
- ✅ 检测 Created 状态：`echo "$CONTAINER_STATUS" | grep -q "Created"`
- ✅ 检查端口绑定错误：`grep -qi "port is already allocated"`
- ✅ 自动删除并重建：`docker rm "${CONTAINER_NAME}"`

#### 7. 自动更新 .env.local
- ✅ 创建成功后调用：`node tools/env/set-database-url-port.js --port "${SELECTED_PORT}"`
- ✅ 错误处理：更新失败时给出警告但不中断流程

### ⚠️ 发现的问题

#### 1. 当前容器状态异常
```
容器状态: Created
错误信息: "port is already allocated" (端口 5432 已被占用)
```

**影响**：这是我们要修复的场景，当前容器处于坏状态，需要测试修复逻辑。

**建议**：执行 `pnpm db:up` 验证坏容器自动修复功能。

#### 2. 端口选择逻辑在容器已存在时的处理
- ✅ 已实现：容器已存在时，从 `docker port` 获取实际端口
- ⚠️ 注意：如果容器已存在但端口与 .env.local 不一致，需要手动同步

### 📋 代码审查结果

#### 1. `tools/env/set-database-url-port.js`
- ✅ URL 解析逻辑正确：使用 `new URL(url)` 解析
- ✅ 端口替换逻辑正确：`buildDatabaseUrl()` 仅替换端口
- ✅ 格式保留：保留引号、注释、缩进
- ✅ 幂等性：端口相同时不更新
- ✅ 错误处理：文件不存在、URL 解析失败都有明确提示

#### 2. `tools/db/up-postgres.sh`
- ✅ 端口选择逻辑完整：5 个候选端口，按优先级尝试
- ✅ 可用性检测兼容：lsof → nc → 无法检测时假设可用
- ✅ 坏容器检测：Created 状态 + 端口绑定错误 → 自动删除重建
- ✅ 重试逻辑：最多 5 次，自动切换端口
- ✅ 自动更新 .env.local：创建成功后调用更新脚本
- ✅ 错误处理：所有关键步骤都有错误提示

#### 3. `package.json`
- ✅ 新增 `db:status` 脚本：用于快速查看容器状态

## 下一步

### 必须验证（在实际环境中）

1. **测试坏容器自动修复**
   ```bash
   # 当前容器处于 Created 状态，端口绑定失败
   pnpm db:up
   # 期望：自动删除坏容器，选择新端口（5433），创建成功
   ```

2. **测试端口自动选择（5432 被占用）**
   ```bash
   # 确保 5432 被占用（或手动占用）
   pnpm db:up
   # 期望：自动选择 5433（或下一个可用端口）
   ```

3. **验证 .env.local 自动更新**
   ```bash
   pnpm db:up
   grep "DATABASE_URL" .env.local
   # 期望：端口已更新为实际使用的端口
   ```

4. **端到端验证**
   ```bash
   pnpm db:init
   # 期望：不再出现 "Database scu does not exist"
   # 期望：migrate/push 成功
   
   pnpm -w --filter api dev
   # 期望：API 正常启动，不再因数据库不存在而崩溃
   ```

### 建议的验证顺序

1. **清理当前坏容器**（可选）
   ```bash
   docker rm scu-postgres  # 清理当前 Created 状态的容器
   ```

2. **执行完整流程**
   ```bash
   pnpm db:up      # 测试端口自动选择 + 坏容器修复
   pnpm env:check  # 验证 DATABASE_URL 已更新
   pnpm db:init    # 验证数据库初始化
   pnpm -w --filter api dev  # 验证 API 启动
   ```

## 结论

### ✅ 代码质量
- 静态语法检查：全部通过
- 逻辑完整性：端口选择、坏容器修复、自动更新均已实现
- 错误处理：关键步骤都有错误提示和恢复建议

### ⚠️ 待实际验证
- 坏容器自动修复功能（当前容器处于 Created 状态，是测试的好场景）
- 端口自动选择在实际占用场景下的表现
- 端到端流程（db:up → db:init → api dev）的完整性

### 📝 建议
1. **立即测试**：当前容器处于 Created 状态，是验证坏容器修复的绝佳场景
2. **验证顺序**：先测试 `pnpm db:up` 验证自动修复，再测试完整流程
3. **如果测试失败**：检查端口占用情况、Docker 状态、.env.local 格式

---

**REVIEW 完成时间**: $(date)
**审查人**: Cursor AI (REVIEW 模式)
**结论**: 代码实现符合计划，待实际环境验证

