# Stage8 · 测试报告与功能强绑定（Final）

**执行时间**: 2025-12-13  
**模式**: EXECUTE → REPORT  
**状态**: ✅ DONE (Final)  
**是否允许回滚**: ❌ 不允许

---

## 一、目标

防止测试报告复用、错配、混用。

**核心原则**:
- 每个功能变更必须对应一个新的测试报告
- 测试报告命名必须规范且唯一
- 禁止复用旧报告

---

## 二、强制规则

### 2.1 测试报告命名规范

**格式**: `docs/TEST_REPORT_<STAGE>_<FEATURE>_<YYYYMMDD>.md`

**示例**:
- ✅ `docs/TEST_REPORT_STAGE6_GUARDRAILS_20251213.md`
- ✅ `docs/TEST_REPORT_STAGE7_TEST_GOVERNANCE_20251213.md`
- ❌ `docs/TEST_REPORT_stage6.md`（不符合规范）
- ❌ `docs/TEST_REPORT_20251213.md`（缺少 Stage 和 Feature）

**规则说明**:
- `STAGE`: 必须为 `STAGE` + 数字（如 `STAGE6`、`STAGE7`）
- `FEATURE`: 必须为大写字母、数字、下划线（如 `GUARDRAILS`、`TEST_GOVERNANCE`）
- `YYYYMMDD`: 必须为 8 位日期（如 `20251213`）

### 2.2 每次变更必须新增测试报告

**规则**:
- ❌ **复用旧报告 = 架构违规**
- ✅ 每次功能变更必须新增对应的测试报告
- ✅ 测试报告必须与功能变更在同一提交中

### 2.3 测试报告与功能强绑定

**要求**:
- 测试报告必须明确关联的功能/Stage
- 测试报告必须包含实际执行的测试命令和真实输出
- 测试报告必须明确测试结论

---

## 三、CI 约束

### 3.1 命名校验

**文件**: `tools/ci/check-test-report-naming.sh`

**功能**:
- 检查所有 `docs/TEST_REPORT_*.md` 文件是否符合命名规范
- 不符合规范的文件会被列出并导致 CI 失败

**执行**:
```bash
bash tools/ci/check-test-report-naming.sh
```

### 3.2 git diff 新增校验

**文件**: `tools/ci/check-test-report-fresh.sh`

**功能**:
- 检查当前变更集中是否包含新的测试报告
- 如果没有新增测试报告，CI 直接失败
- 防止复用旧报告

**执行**:
```bash
bash tools/ci/check-test-report-fresh.sh
```

**逻辑**:
- PR 事件：比较 `origin/main` 和 `HEAD`
- Push 事件：比较 `HEAD~1` 和 `HEAD`
- 必须检测到至少一个新增的 `docs/TEST_REPORT_*.md` 文件

### 3.3 CI Workflow 集成

**文件**: `.github/workflows/ci.yml`

**新增步骤**（在 Stage7 guard 之后，Lint 之前）:
```yaml
- name: Stage8 guard - Test report naming
  run: bash tools/ci/check-test-report-naming.sh

- name: Stage8 guard - Test report freshness
  run: bash tools/ci/check-test-report-fresh.sh
```

**执行顺序**:
1. Checkout
2. Setup pnpm / Node.js
3. Install dependencies
4. Stage6 guard - Prisma single source
5. Stage6 guard - Nonce fallback protected
6. Stage7 guard - Test report required
7. **Stage8 guard - Test report naming** ← 新增
8. **Stage8 guard - Test report freshness** ← 新增
9. Lint
10. Build

---

## 四、违规示例（会被拦截）

### 示例 1：命名不规范

**违规操作**:
- 创建 `docs/TEST_REPORT_stage6.md`（小写 stage）
- 创建 `docs/TEST_REPORT_20251213.md`（缺少 Stage 和 Feature）

**拦截方式**:
- CI 脚本失败：`❌ Invalid TEST_REPORT naming detected:`
- 列出所有不符合规范的文件

### 示例 2：复用旧报告

**违规操作**:
- 提交代码变更但未新增测试报告
- 引用已有的测试报告文件

**拦截方式**:
- CI 脚本失败：`❌ No new TEST_REPORT added in this change set`
- `❌ Reusing old reports is forbidden`

### 示例 3：测试报告与功能不匹配

**违规操作**:
- 使用其他功能的测试报告
- 测试报告中的功能说明与实际变更不符

**拦截方式**:
- 虽然 CI 脚本可能通过（文件存在且命名正确），但 Code Review 阶段应拒绝
- 测试报告内容必须与功能变更一致

---

## 五、执行与验收清单

### 5.1 新增文件

- [x] `tools/ci/check-test-report-naming.sh` - 命名规范检查脚本
- [x] `tools/ci/check-test-report-fresh.sh` - 防复用检查脚本
- [x] `docs/STAGE8_TEST_REPORT_BINDING_FINAL.md` - Stage8 Final 文档

### 5.2 修改文件

- [x] `.github/workflows/ci.yml` - 新增 Stage8 guard 步骤

### 5.3 验证清单

- [x] 命名规范检查脚本已创建且可执行
- [x] 防复用检查脚本已创建且可执行
- [x] CI Workflow 已集成 Stage8 guard
- [x] Stage8 Final 文档已生成

---

## 六、与 Stage5 / Stage6 / Stage7 的关系

### 6.1 一致性

- Stage5: 架构约束（Prisma 单一来源）
- Stage6: 架构约束自动化防线（ESLint + CI 脚本）
- Stage7: 功能级测试强制化（测试报告 + CI 检查）
- Stage8: 测试报告与功能强绑定（命名规范 + 防复用）

### 6.2 互补性

- Stage7: 确保测试报告存在
- Stage8: 确保测试报告规范且与功能强绑定

### 6.3 执行顺序

1. **开发阶段**: 遵循 Stage5/Stage6 约束
2. **测试阶段**: 必须生成测试报告（Stage7）
3. **验证阶段**: 检查测试报告规范性和新鲜度（Stage8）
4. **CI 阶段**: 自动检查所有约束（Stage6 + Stage7 + Stage8）

---

## 七、永久性结论

### Stage8 = 不允许回滚

**理由**:
1. ✅ 防止测试报告复用、错配、混用
2. ✅ 确保测试报告与功能强绑定
3. ✅ CI 自动检查，不可绕过
4. ✅ 与 Stage5/Stage6/Stage7 完全一致

**约束执行**:
- 任何违反约束的提交**直接拒绝**（无需讨论）
- 命名不规范 → CI 失败
- 复用旧报告 → CI 失败

**报告生成时间**: 2025-12-13  
**报告状态**: 最终版（Final）  
**是否允许回滚**: ❌ **不允许**

---

## 八、后续维护

1. **保持命名规范**
   - 确保所有新测试报告遵循命名规范
   - 定期检查现有报告是否符合规范

2. **监控 CI 失败**
   - 任何 Stage8 guard 失败必须修复
   - 不允许通过修改脚本绕过检查

3. **扩展约束**
   - 如需新增测试报告要求，更新脚本和文档
   - 保持与 Stage5/Stage6/Stage7 的一致性

---

**报告结束**

