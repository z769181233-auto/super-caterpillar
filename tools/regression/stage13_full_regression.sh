#!/bin/bash
# Stage13 完整回归测试脚本
# 用途：验证 Stage13 CE Core Layer 实现是否符合所有验收标准
# 执行：bash tools/regression/stage13_full_regression.sh

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志目录
LOG_DIR="logs/regression"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo -e "${GREEN}=== Stage13 完整回归测试开始 ===${NC}"
echo "仓库根目录: $REPO_ROOT"
echo "日志目录: $LOG_DIR"
echo ""

# ============================================
# 1. 环境与依赖一致性检查
# ============================================
echo -e "${YELLOW}[1/8] 环境与依赖一致性检查${NC}"
mkdir -p "$LOG_DIR"

date | tee "$LOG_DIR/time.txt"
echo "开始时间: $(cat "$LOG_DIR/time.txt")"

node -v | tee "$LOG_DIR/node.txt"
pnpm -v | tee "$LOG_DIR/pnpm.txt"

echo "安装依赖..."
pnpm -w install 2>&1 | tee "$LOG_DIR/pnpm_install.txt"
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✓ 依赖安装成功${NC}"
else
    echo -e "${RED}✗ 依赖安装失败${NC}"
    exit 1
fi

# ============================================
# 2. Prisma/DB 契约回归
# ============================================
echo -e "${YELLOW}[2/8] Prisma/DB 契约回归${NC}"
cd packages/database

echo "执行 prisma db push..."
pnpm db:push 2>&1 | tee "../../$LOG_DIR/prisma_db_push.txt"
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✓ DB Push 成功${NC}"
else
    echo -e "${RED}✗ DB Push 失败${NC}"
    exit 1
fi

echo "执行 prisma generate..."
pnpm db:generate 2>&1 | tee "../../$LOG_DIR/prisma_generate.txt"
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✓ Prisma Generate 成功${NC}"
else
    echo -e "${RED}✗ Prisma Generate 失败${NC}"
    exit 1
fi

cd "$REPO_ROOT"

# ============================================
# 3. 类型/语法/依赖路径：全量编译回归
# ============================================
echo -e "${YELLOW}[3/8] 全量编译回归${NC}"
pnpm -w build 2>&1 | tee "$LOG_DIR/pnpm_build.txt"
BUILD_EXIT_CODE=${PIPESTATUS[0]}

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ 编译成功${NC}"
else
    echo -e "${RED}✗ 编译失败（退出码: $BUILD_EXIT_CODE）${NC}"
    echo "检查日志: $LOG_DIR/pnpm_build.txt"
    exit 1
fi

# 检查是否有 TypeScript 错误
TS_ERRORS=$(grep -E "error TS" "$LOG_DIR/pnpm_build.txt" | wc -l | xargs)
if [ "$TS_ERRORS" -gt 0 ]; then
    echo -e "${RED}✗ 发现 $TS_ERRORS 个 TypeScript 错误${NC}"
    grep -E "error TS" "$LOG_DIR/pnpm_build.txt" | head -10
    exit 1
else
    echo -e "${GREEN}✓ 无 TypeScript 错误${NC}"
fi

# ============================================
# 4. 服务启动（记录日志，但不阻塞）
# ============================================
echo -e "${YELLOW}[4/8] 服务启动准备${NC}"
echo "注意：服务需要在独立终端启动，本脚本仅记录启动命令"
echo ""
echo "Terminal A (API):"
echo "  pnpm --filter api dev | tee logs/regression/api_dev.txt"
echo ""
echo "Terminal B (Workers):"
echo "  pnpm --filter workers dev | tee logs/regression/workers_dev.txt"
echo ""
echo "Terminal C (Web, 可选):"
echo "  pnpm --filter web dev | tee logs/regression/web_dev.txt"
echo ""
echo -e "${YELLOW}请手动启动服务后，按 Enter 继续...${NC}"
read -r

# ============================================
# 5. API Spec 指定的 5 项测试
# ============================================
echo -e "${YELLOW}[5/8] API Spec 测试（需要服务运行）${NC}"

# 检查 API 是否运行
API_URL="${API_URL:-http://localhost:3000}"
if ! curl -s -f "$API_URL/api/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ API 服务未运行（$API_URL）${NC}"
    echo "请先启动 API 服务"
    exit 1
fi

echo -e "${GREEN}✓ API 服务运行中${NC}"

# 5.1 签名验证测试（需要测试代码）
echo "5.1 签名验证测试..."
echo "注意：需要在 apps/api 中添加 Jest 测试"
echo "测试文件: apps/api/src/auth/hmac/hmac-auth.guard.spec.ts (待创建)"
echo ""

# 5.2 Nonce 重放测试
echo "5.2 Nonce 重放测试..."
echo "注意：需要在 apps/api 中添加 Jest 测试"
echo "测试文件: apps/api/src/auth/nonce/nonce.service.spec.ts (待创建)"
echo ""

# 5.3 m3u8/HLS 播放测试
echo "5.3 m3u8/HLS 播放测试..."
echo "注意：需要先有 asset 数据，然后测试 GET /assets/:assetId/hls"
echo ""

# 5.4 隐形指纹完整性测试
echo "5.4 隐形指纹完整性测试..."
echo "注意：需要验证指纹写入和提取流程"
echo ""

# 5.5 Novel Parsing 正确性测试
echo "5.5 Novel Parsing 正确性测试..."
echo "注意：需要测试 POST /story/parse (CE06)"
echo ""

echo -e "${YELLOW}API Spec 测试需要手动执行或添加自动化测试代码${NC}"
echo "详细测试步骤请参考 reports/STAGE13_FULL_REGRESSION_REPORT.md"

# ============================================
# 6. Stage13 核心链路端到端回归
# ============================================
echo -e "${YELLOW}[6/8] Stage13 核心链路端到端回归${NC}"
echo ""
echo "成功链路测试步骤："
echo "1. Web 端创建项目"
echo "2. 上传小说（触发 NOVEL_ANALYSIS + CE Core DAG）"
echo "3. 等待 CE06 → CE03 → CE04 完成"
echo "4. 执行 SQL 验证（见报告模板）"
echo ""
echo "失败链路测试步骤："
echo "1. 让 CE03 不可达（停服务或改 CE03_BASE_URL）"
echo "2. 再上传一次小说"
echo "3. 验证 CE04 SKIPPED 审计"
echo ""
echo -e "${YELLOW}请手动执行上述步骤，并将 SQL 结果记录到报告中${NC}"

# ============================================
# 7. 生成回归报告摘要
# ============================================
echo -e "${YELLOW}[7/8] 生成回归报告摘要${NC}"
REPORT_FILE="reports/STAGE13_FULL_REGRESSION_REPORT.md"

cat > "$REPORT_FILE" << 'EOF'
# Stage13 完整回归测试报告

**生成时间**: $(date)
**执行脚本**: tools/regression/stage13_full_regression.sh

---

## 1. 环境与依赖一致性检查

### 环境信息
- **Node 版本**: $(cat logs/regression/node.txt)
- **pnpm 版本**: $(cat logs/regression/pnpm.txt)
- **开始时间**: $(cat logs/regression/time.txt)

### 依赖安装
- **状态**: [待填充]
- **日志**: logs/regression/pnpm_install.txt

---

## 2. Prisma/DB 契约回归

### DB Push
- **状态**: [待填充]
- **日志**: logs/regression/prisma_db_push.txt

### Prisma Generate
- **状态**: [待填充]
- **日志**: logs/regression/prisma_generate.txt

---

## 3. 全量编译回归

### 编译结果
- **状态**: [待填充]
- **TypeScript 错误数**: [待填充]
- **日志**: logs/regression/pnpm_build.txt

### 关键错误（如有）
```
[待填充]
```

---

## 4. 服务启动

### API 服务
- **状态**: [待填充]
- **日志**: logs/regression/api_dev.txt

### Workers 服务
- **状态**: [待填充]
- **日志**: logs/regression/workers_dev.txt

### Web 服务（如需要）
- **状态**: [待填充]
- **日志**: logs/regression/web_dev.txt

---

## 5. API Spec 指定的 5 项测试

### 5.1 签名验证单测（HMAC）

**测试步骤**:
1. [待填充]

**请求样例**:
```bash
[待填充]
```

**返回结果**:
```json
[待填充]
```

**结论**: [PASS/FAIL]

---

### 5.2 Nonce 重放测试

**测试步骤**:
1. [待填充]

**请求样例**:
```bash
[待填充]
```

**返回结果**:
```json
[待填充]
```

**结论**: [PASS/FAIL]

---

### 5.3 m3u8/HLS 播放测试

**测试步骤**:
1. [待填充]

**请求样例**:
```bash
[待填充]
```

**返回结果**:
```bash
[待填充]
```

**结论**: [PASS/FAIL]

---

### 5.4 隐形指纹完整性测试

**测试步骤**:
1. [待填充]

**验证点**:
- [待填充]

**结论**: [PASS/FAIL]

---

### 5.5 Novel Parsing 正确性测试

**测试步骤**:
1. [待填充]

**输入样例**:
```json
[待填充]
```

**输出验证**:
- [待填充]

**结论**: [PASS/FAIL]

---

## 6. Stage13 核心链路端到端回归

### 6.1 成功链路

#### 测试步骤
1. 创建项目
2. 上传小说（触发 NOVEL_ANALYSIS + CE Core DAG）
3. 等待 CE06 → CE03 → CE04 完成

#### SQL 验证 1: Job 顺序与 traceId

```sql
SELECT id, type, status, trace_id, created_at
FROM shot_jobs
WHERE project_id = '<projectId>'
  AND type IN ('CE06_NOVEL_PARSING','CE03_VISUAL_DENSITY','CE04_VISUAL_ENRICHMENT')
ORDER BY created_at;
```

**实际结果**:
```
[待填充 SQL 输出]
```

**验收**: [PASS/FAIL]
- ✅ 3 条记录
- ✅ status 全 SUCCEEDED
- ✅ trace_id 三条相同，且形如 `ce_pipeline_...`

---

#### SQL 验证 2: 审计日志

```sql
SELECT id, action, details->>'status' AS status, details->>'traceId' AS trace_id, created_at
FROM audit_logs
WHERE resource_type='job'
  AND resource_id IN (
    SELECT id FROM shot_jobs
    WHERE project_id='<projectId>'
      AND type IN ('CE06_NOVEL_PARSING','CE03_VISUAL_DENSITY','CE04_VISUAL_ENRICHMENT')
  )
ORDER BY created_at;
```

**实际结果**:
```
[待填充 SQL 输出]
```

**验收**: [PASS/FAIL]
- ✅ 3 条 SUCCESS 审计
- ✅ trace_id 相同

---

#### SQL 验证 3: 落库验证

```sql
SELECT id, project_id, created_at FROM novel_parse_results WHERE project_id='<projectId>';
SELECT id, project_id, engine, created_at FROM quality_metrics WHERE project_id='<projectId>' ORDER BY created_at;
```

**实际结果**:
```
[待填充 SQL 输出]
```

**验收**: [PASS/FAIL]
- ✅ novel_parse_results ≥ 1
- ✅ quality_metrics ≥ 2

---

### 6.2 失败链路（CE03 fail → CE04 SKIPPED）

#### 测试步骤
1. 让 CE03 不可达（停服务或改 CE03_BASE_URL）
2. 再上传一次小说
3. 验证 CE04 SKIPPED 审计

#### SQL 验证 1: Job 状态

```sql
SELECT id, type, status, last_error, trace_id, created_at
FROM shot_jobs
WHERE project_id = '<projectId>'
  AND type IN ('CE06_NOVEL_PARSING','CE03_VISUAL_DENSITY','CE04_VISUAL_ENRICHMENT')
ORDER BY created_at;
```

**实际结果**:
```
[待填充 SQL 输出]
```

**验收**: [PASS/FAIL]
- ✅ CE06 SUCCEEDED
- ✅ CE03 FAILED（last_error 有内容）
- ✅ CE04 FAILED（被阻断）

---

#### SQL 验证 2: CE04 SKIPPED 审计

```sql
SELECT id, action, details->>'status' AS status, details->>'reason' AS reason, details->>'traceId' AS trace_id, created_at
FROM audit_logs
WHERE action='CE_CE04_VISUAL_ENRICHMENT_SKIPPED'
ORDER BY created_at DESC
LIMIT 5;
```

**实际结果**:
```
[待填充 SQL 输出]
```

**验收**: [PASS/FAIL]
- ✅ status = SKIPPED
- ✅ reason 包含 "Previous CE Job failed: CE03_VISUAL_DENSITY"
- ✅ trace_id 与同 pipeline 一致

---

## 7. 回归结论

### 验收门槛检查

- [ ] `pnpm -w build` 通过（无 TS 编译失败）
- [ ] Prisma db push + generate 成功，且与 schema 一致
- [ ] API Spec 规定的 5 项测试全部有证据且通过
- [ ] 安全链路（HMAC/Nonce）通过，错误码符合规范
- [ ] 审计链路可复现（trace_id 串起来查得到）

### 总体结论

**是否达到"可继续开发下一阶段"的门槛**: [PASS/FAIL]

**未通过项**:
1. [待填充]
2. [待填充]

**备注**:
[待填充]

---

## 附录：关键日志文件

- 环境信息: logs/regression/time.txt, node.txt, pnpm.txt
- 依赖安装: logs/regression/pnpm_install.txt
- Prisma: logs/regression/prisma_db_push.txt, prisma_generate.txt
- 编译: logs/regression/pnpm_build.txt
- 服务日志: logs/regression/api_dev.txt, workers_dev.txt, web_dev.txt

EOF

echo -e "${GREEN}✓ 回归报告模板已生成: $REPORT_FILE${NC}"

# ============================================
# 8. 总结
# ============================================
echo -e "${YELLOW}[8/8] 回归测试完成${NC}"
echo ""
echo -e "${GREEN}=== 回归测试总结 ===${NC}"
echo "1. ✓ 环境检查完成"
echo "2. ✓ Prisma/DB 契约回归完成"
echo "3. ✓ 全量编译回归完成"
echo "4. ⚠️  服务启动（需手动）"
echo "5. ⚠️  API Spec 测试（需手动或添加测试代码）"
echo "6. ⚠️  核心链路回归（需手动执行并记录 SQL）"
echo ""
echo "下一步："
echo "1. 手动启动服务（Terminal A/B/C）"
echo "2. 执行 API Spec 测试并记录结果"
echo "3. 执行核心链路回归并记录 SQL 结果"
echo "4. 更新报告: $REPORT_FILE"
echo "5. 提交回归脚本 + 报告 + 测试代码"
echo ""
echo -e "${GREEN}回归脚本执行完成！${NC}"

