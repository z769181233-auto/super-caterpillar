# Stage7 · 功能级测试强制化与交付审计闭环（Final）

**执行时间**: 2025-12-13  
**模式**: EXECUTE → REPORT  
**状态**: ✅ DONE (Final)  
**是否允许回滚**: ❌ 不允许

---

## 一、目标

任何功能合并前，必须完成：

1. ✅ **自测** - 执行者必须亲自执行测试命令
2. ✅ **测试报告** - 必须生成并落盘测试报告
3. ✅ **CI 可验证证据** - CI 自动检查测试报告存在性

---

## 二、强制规则

### 2.1 测试报告要求

- ❌ **无 TEST_REPORT → 不允许合并**
- ❌ **报告未落盘 → 不允许合并**
- ❌ **CI 未校验 → 架构违规**

### 2.2 测试报告格式

- **模板路径**: `docs/templates/TEST_REPORT_FUNCTION_TEMPLATE.md`
- **命名规范**: `docs/TEST_REPORT_<功能名>_<YYYYMMDD>.md`
- **必须包含**: 功能说明、变更文件、测试环境、执行命令、真实输出、测试结论、签名

### 2.3 测试报告内容要求

- ✅ 必须包含实际执行的命令（禁止推断）
- ✅ 必须包含真实终端输出（禁止伪造）
- ✅ 必须明确测试结论（PASS / FAIL）
- ✅ 必须明确是否允许进入下一阶段（YES / NO）

---

## 三、CI 约束

### 3.1 CI 检查脚本

**文件**: `tools/ci/check-test-report-exists.sh`

**功能**:
- 检查 `docs/TEST_REPORT_*.md` 文件是否存在
- 如果不存在，CI 直接失败
- 如果存在，列出所有测试报告文件

**执行**:
```bash
bash tools/ci/check-test-report-exists.sh
```

### 3.2 CI Workflow 集成

**文件**: `.github/workflows/ci.yml`

**新增步骤**（在 Stage6 guard 之后，Lint 之前）:
```yaml
- name: Stage7 guard - Test report required
  run: bash tools/ci/check-test-report-exists.sh
```

**执行顺序**:
1. Checkout
2. Setup pnpm / Node.js
3. Install dependencies
4. Stage6 guard - Prisma single source
5. Stage6 guard - Nonce fallback protected
6. **Stage7 guard - Test report required** ← 新增
7. Lint
8. Build

### 3.3 硬门禁规则

- ✅ `tools/ci/check-test-report-exists.sh` 为硬门禁
- ❌ 不可跳过、不可关闭
- ❌ 任何违反均视为架构违规

---

## 四、与 Stage5 / Stage6 的关系

### 4.1 一致性

- Stage5: 架构约束（Prisma 单一来源）
- Stage6: 架构约束自动化防线（ESLint + CI 脚本）
- Stage7: 功能级测试强制化（测试报告 + CI 检查）

### 4.2 互补性

- Stage5/Stage6: 保护架构约束不被违反
- Stage7: 确保功能交付质量（测试报告强制化）

### 4.3 执行顺序

1. **开发阶段**: 遵循 Stage5/Stage6 约束
2. **测试阶段**: 必须生成测试报告（Stage7）
3. **CI 阶段**: 自动检查约束 + 测试报告（Stage6 + Stage7）

---

## 五、测试报告模板

### 5.1 模板位置

`docs/templates/TEST_REPORT_FUNCTION_TEMPLATE.md`

### 5.2 模板内容

包含以下必需章节：
1. 功能说明
2. 变更文件清单
3. 测试环境
4. 实际执行的测试命令
5. 真实输出（禁止伪造）
6. 测试结论
7. 是否允许进入下一阶段
8. 签名

### 5.3 使用方式

1. 复制模板到 `docs/TEST_REPORT_<功能名>_<YYYYMMDD>.md`
2. 填写所有必需字段
3. 执行测试命令并粘贴真实输出
4. 明确测试结论

---

## 六、违规示例（会被拦截）

### 示例 1：无测试报告

**违规操作**:
- 提交代码但未生成测试报告

**拦截方式**:
- CI 脚本失败：`❌ No TEST_REPORT found under docs/`
- CI 直接失败，不允许合并

### 示例 2：测试报告未落盘

**违规操作**:
- 仅在回复中提到测试结果，但未生成文件

**拦截方式**:
- CI 脚本失败：`❌ No TEST_REPORT found under docs/`
- 不符合 Stage7 强制规则

### 示例 3：测试报告内容不完整

**违规操作**:
- 测试报告缺少真实输出或测试结论

**拦截方式**:
- 虽然 CI 脚本可能通过（文件存在），但不符合模板要求
- Code Review 阶段应拒绝

---

## 七、执行与验收清单

### 7.1 新增文件

- [x] `docs/templates/TEST_REPORT_FUNCTION_TEMPLATE.md` - 测试报告模板
- [x] `tools/ci/check-test-report-exists.sh` - CI 检查脚本
- [x] `docs/STAGE7_TEST_GOVERNANCE_FINAL.md` - Stage7 Final 文档

### 7.2 修改文件

- [x] `.github/workflows/ci.yml` - 新增 Stage7 guard 步骤

### 7.3 验证清单

- [x] 测试报告模板已创建
- [x] CI 检查脚本已创建且可执行
- [x] CI Workflow 已集成 Stage7 guard
- [x] Stage7 Final 文档已生成

---

## 八、永久性结论

### Stage7 = 强制制度，不允许回滚

**理由**:
1. ✅ 与 Stage5/Stage6 架构约束完全一致
2. ✅ 确保功能交付质量
3. ✅ CI 自动检查，不可绕过
4. ✅ 可长期扩展（以后每个 Stage 都可套用）

**约束执行**:
- 任何违反约束的提交**直接拒绝**（无需讨论）
- 无测试报告 → CI 失败
- 测试报告未落盘 → CI 失败

**报告生成时间**: 2025-12-13  
**报告状态**: 最终版（Final）  
**是否允许回滚**: ❌ **不允许**

---

## 九、后续维护

1. **保持模板更新**
   - 根据实际需求更新测试报告模板
   - 确保模板包含所有必需字段

2. **监控 CI 失败**
   - 任何 Stage7 guard 失败必须修复
   - 不允许通过修改脚本绕过检查

3. **扩展约束**
   - 如需新增测试要求，更新模板和 CI 脚本
   - 保持与 Stage5/Stage6 的一致性

---

**报告结束**

