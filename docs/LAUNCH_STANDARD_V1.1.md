# 超级毛毛虫宇宙 · 全量上线标准 V1.1

**文档版本**: V1.1  
**生效日期**: 2025-12-18  
**状态**: 🔒 **强制执行**

---

## 地位说明（必须写在文档首页）

**本文档是超级毛毛虫宇宙在"正式上线生产"前的最高执行规范。**

Cursor（及任何 AI/开发者）在进行任何代码修改前，必须完整阅读并严格遵守本文档。

**任何偏离本文档的行为，均视为违规实现。**

---

## 一、上线目标的唯一解释（防止歧义）

### "全部功能完善后再上线"的官方定义

**全部功能完善后再上线** =

**Stage 1 → Stage 2 → Stage 3 → Stage 4 全部 Close**，且每一个 Stage / 模块的 Close，必须同时满足：

- ✅ **自动化验证全部通过**
- ✅ **人工验证明确 PASS**

### 禁止行为

- ❌ 不存在"先上线一部分""先跑 Demo""功能差不多了"
- ❌ 不存在"AI 能力以后补"
- ❌ 不存在"先上线再修复"

---

## 二、Stage 执行顺序（不可跳跃）

### 严格按照执行顺序

1. **Stage 1：平台与安全基座**
2. **Stage 2：任务调度与生产管线**
3. **Stage 3：AI 引擎体系（含 CE06 小说分析）**
4. **Stage 4：质量、安全、自动修复与发布治理**

### 强制规则

- **Stage N 未 Close → 禁止进入 Stage N+1**
- **不允许跨 Stage 改代码**
- **不允许"顺手补后面的能力"**

---

## 三、对当前系统状态的统一认定（防止误用）

### 小说分析引擎（CE06）的官方认定

**当前小说分析引擎仅为 Import Stub / 文本切片器**

- 不具备任何语义分析、分镜、导演、补全能力
- 在 Stage 3 Close 之前，禁止作为任何生产依赖

**这一认定必须：**

- ✅ 写进文档
- ✅ 写进代码注释
- ✅ 写进风险登记

---

## 四、Verification & Close Policy（验证与关闭策略）

### 4.1 Close 的唯一判定标准（强制执行）

**任何 Stage / 模块 / 功能的 Close，必须同时满足：**

1. ✅ **自动化验证全部通过**（Automation Verification）
2. ✅ **人工验证明确 PASS**（Manual Verification）

**缺一不可，否则一律 NOT CLOSE。**

这不是建议，是上线标准的一部分。

---

### 4.2 自动化验证（Automation Verification）

**这是"机器能保证的下限"，必须做到。**

#### 4.2.1 必须覆盖的范围

**A. 工程与契约**

- TypeCheck / Lint / Build
- API Contract（Request/Response Schema）
- DB Schema & Migration 校验
- 外键 / 约束 / 默认值验证

**B. 安全**

- HMAC / Nonce / Timestamp
- 越权访问测试
- 资源签名访问 & 过期
- Replay 攻击防护

**C. 任务与并发**

- Task 幂等
- Worker 重试 / 超时 / 回收
- 并发压力下队列不丢任务

**D. 可观测**

- `/health/live` / `/health/ready`
- 关键指标存在
- 日志落盘 / 可检索

#### 4.2.2 形式要求（强制）

- ✅ **必须是脚本**
- ✅ **必须可重复执行**
- ✅ **必须有"通过/失败"的硬结果**
- ✅ **必须生成日志或报告文件**

#### 4.2.3 失败即阻断规则

**任何自动化验证失败，立即阻断 Close，不允许进入下一 Stage。**

---

### 4.3 人工验证（Manual Verification）

**这是"机器保证不了的上限"，同样是 Close 的硬条件。**

**人工验证不是随便看看，而是标准化检查清单。**

#### 4.3.1 必须包含的维度

**A. 功能语义**

- 功能是否符合 PRD 描述
- 是否存在"看似可用，实际误导"的行为
- 输入/输出是否符合用户心智

**B. 链路真实演练**

- 真实用户路径完整走一遍
- 非理想输入（缺字段、异常顺序、重复操作）
- 失败后的恢复是否符合预期

**C. 风险评估**

- 这个模块上线后，最坏情况是什么？
- 是否有止血方案？
- 是否影响已有生产链路？

**D. 文档一致性**

- 是否与 PRD / Spec / Architecture 描述一致
- 是否存在"代码做了，但文档没更新"或反之

#### 4.3.2 形式要求（强制）

- ✅ **必须有 Checklist**
- ✅ **必须逐条勾选**
- ✅ **必须有结论：PASS / FAIL / CONDITIONAL PASS**
- ✅ **必须能追溯到具体 Stage / 模块 / 版本**

#### 4.3.3 执行角色与职责

- **执行人**: 必须明确标注执行人姓名/ID
- **执行时间**: 必须标注执行时间
- **结论签名**: 必须有人工签名确认

---

### 4.4 Close 判定规则

#### 4.4.1 Close 的必要条件

**Close = 自动化验证全部通过 AND 人工验证 PASS**

- ✅ 自动化验证报告：所有脚本 PASS
- ✅ 人工验证记录：所有 Checklist 项 PASS
- ✅ Close Decision：明确 CLOSE / NOT CLOSE

#### 4.4.2 Close 的禁止条件

**以下情况一律 NOT CLOSE：**

- ❌ 任何自动化验证失败
- ❌ 任何人工验证项 FAIL
- ❌ 缺少自动化验证报告
- ❌ 缺少人工验证记录
- ❌ 缺少 Close Decision

#### 4.4.3 Conditional Close 的使用边界

**Conditional Close 仅允许在以下情况：**

- ✅ **非 P0 风险**
- ✅ **有书面说明理由**
- ✅ **有明确的后续修复计划**
- ✅ **不影响已有生产链路**

**P0 风险一律不允许 Conditional Close。**

---

### 4.5 Close 必须产出的 3 样东西

**从现在开始，任何 Close 都必须产出这 3 样东西：**

#### 1. 自动化验证报告

**必须包含：**

- 脚本列表
- 执行命令
- 结果摘要（PASS / FAIL）
- 日志路径

**模板**: `docs/templates/AUTOMATION_VERIFICATION_REPORT.md`

#### 2. 人工验证记录

**必须包含：**

- Checklist（逐条勾选）
- 执行人
- 结论（PASS / FAIL / CONDITIONAL PASS）
- 风险备注

**模板**: `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`

#### 3. Close Decision

**必须包含：**

- CLOSE / NOT CLOSE
- 是否允许进入下一 Stage
- 是否需要回滚或补丁

---

### 4.6 验证体系的两条并行链路

**验证体系拆成两条并行但强绑定的链路：**

1. **自动化验证链路**：机器能保证的下限
2. **人工验证链路**：机器保证不了的上限

**两条链路必须同时满足，缺一不可。**

---

## 五、验证与 Close 的统一规则（已整合到第四章）

**本章节内容已整合到《四、Verification & Close Policy》中。**

**核心规则：**

- Close = 自动化验证全部通过 AND 人工验证 PASS
- 任一失败 → NOT CLOSE
- 未 Close → 禁止进入下一 Stage

---

## 六、Stage Definition of Done (DoD)

### Stage 1: 平台与安全基座

#### DoD 清单（每项必须明确验证方式）

**1. DB Schema 完全对齐 DBSpec V1.1**

- **自动化验证**:
  - `npx prisma validate`
  - `npx prisma migrate status`
  - `bash tools/gate/run_launch_gates.sh` (Gate 1)
- **人工验证**:
  - Checklist: DB Schema 对齐检查（`docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`）
  - 逐项对比 DBSpec V1.1 与 Prisma Schema
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**2. API 契约完全对齐 APISpec V1.1**

- **自动化验证**:
  - `bash tools/gate/run_launch_gates.sh` (Gate 2-3)
  - API Contract Schema 验证脚本
- **人工验证**:
  - Checklist: API 契约对齐检查
  - 逐项对比 APISpec V1.1 与 Controller/DTO
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**3. 安全链路（HMAC/Nonce/Timestamp）完整实现**

- **自动化验证**:
  - `bash tools/gate/run_launch_gates.sh` (Gate 3)
  - HMAC/Nonce/Timestamp 专项测试脚本
- **人工验证**:
  - Checklist: 安全链路完整性检查
  - 安全链路端到端验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS（P0 风险，不允许 Conditional Close）

**4. 审计日志覆盖所有关键操作**

- **自动化验证**:
  - 审计日志覆盖率测试脚本
- **人工验证**:
  - Checklist: 审计日志完整性检查
  - 关键操作审计日志验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**5. 自动化验证脚本全部通过**

- **验证方式**: 运行所有 Stage 1 自动化验证脚本
- **Close 判定**: 所有脚本 PASS

**6. 人工验证 Checklist 全部 PASS**

- **验证方式**: 完成 `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md` (Stage 1 部分)
- **Close 判定**: 所有 Checklist 项 PASS，执行人已签名

#### Stage 1 总体 Close 判定

**Close = 所有 DoD 项（1-6）全部 Close**

- ✅ 任一 DoD 项未 Close → Stage 1 NOT CLOSE
- ✅ Stage 1 未 Close → 禁止进入 Stage 2

### Stage 2: 任务调度与生产管线

#### DoD 清单（每项必须明确验证方式）

**1. Engine Hub 核心架构完整实现**

- **自动化验证**:
  - Engine Hub 架构测试脚本
  - `bash tools/smoke/run_video_e2e.sh`
- **人工验证**:
  - Checklist: Engine Hub 架构完整性检查
  - 架构设计符合 Stage 2 规划文档
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**2. Orchestrator 调度逻辑完整实现**

- **自动化验证**:
  - Orchestrator 调度测试脚本
  - 任务调度 E2E 测试
- **人工验证**:
  - Checklist: Orchestrator 调度逻辑检查
  - 调度算法正确性验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**3. Worker 节点注册与心跳机制完整**

- **自动化验证**:
  - Worker 注册与心跳测试脚本
- **人工验证**:
  - Checklist: Worker 节点机制检查
  - Worker 注册与心跳端到端验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**4. 任务重试与超时机制完整**

- **自动化验证**:
  - 任务重试与超时测试脚本
- **人工验证**:
  - Checklist: 任务重试与超时机制检查
  - 重试与超时场景验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**5. 自动化验证脚本全部通过**

- **验证方式**: 运行所有 Stage 2 自动化验证脚本
- **Close 判定**: 所有脚本 PASS

**6. 人工验证 Checklist 全部 PASS**

- **验证方式**: 完成 `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md` (Stage 2 部分)
- **Close 判定**: 所有 Checklist 项 PASS，执行人已签名

#### Stage 2 总体 Close 判定

**Close = 所有 DoD 项（1-6）全部 Close**

- ✅ 任一 DoD 项未 Close → Stage 2 NOT CLOSE
- ✅ Stage 2 未 Close → 禁止进入 Stage 3

### Stage 3: AI 引擎体系

#### DoD 清单（每项必须明确验证方式）

**1. 结构分析引擎（CE06）完整实现（非 Import Stub）**

- **自动化验证**:
  - 小说导入 E2E 测试脚本
  - 结构分析引擎能力测试（语义分析、分镜、导演、补全）
- **人工验证**:
  - Checklist: 结构分析引擎能力检查
  - 验证引擎非 Import Stub，具备完整能力
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS（P0 风险，不允许 Conditional Close）

**2. 引擎通过 Engine Hub 统一调用**

- **自动化验证**:
  - Engine Hub 调用链路测试脚本
- **人工验证**:
  - Checklist: Engine Hub 集成检查
  - 验证引擎通过 Engine Hub 统一调用
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**3. 结构树生成符合 DBSpec V1.1**

- **自动化验证**:
  - 结构树生成验证脚本
  - DB Schema 对齐验证
- **人工验证**:
  - Checklist: 结构树生成检查
  - 验证生成的结构符合 DBSpec V1.1
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**4. Studio 前端完整展示和编辑结构**

- **自动化验证**:
  - 前端 E2E 测试（Playwright/Cypress）
- **人工验证**:
  - Checklist: Studio 前端功能检查
  - 前端展示和编辑功能端到端验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**5. 自动化验证脚本全部通过**

- **验证方式**: 运行所有 Stage 3 自动化验证脚本
- **Close 判定**: 所有脚本 PASS

**6. 人工验证 Checklist 全部 PASS**

- **验证方式**: 完成 `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md` (Stage 3 部分)
- **Close 判定**: 所有 Checklist 项 PASS，执行人已签名

#### Stage 3 总体 Close 判定

**Close = 所有 DoD 项（1-6）全部 Close**

- ✅ 任一 DoD 项未 Close → Stage 3 NOT CLOSE
- ✅ Stage 3 未 Close → 禁止进入 Stage 4

### Stage 4: 质量、安全、自动修复与发布治理

#### DoD 清单（每项必须明确验证方式）

**1. 质量门禁完整实现**

- **自动化验证**:
  - 质量门禁测试脚本
  - 全量回归测试
- **人工验证**:
  - Checklist: 质量门禁功能检查
  - 质量门禁端到端验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS（P0 风险，不允许 Conditional Close）

**2. 自动修复机制完整实现**

- **自动化验证**:
  - 自动修复机制测试脚本
- **人工验证**:
  - Checklist: 自动修复机制检查
  - 自动修复场景验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS（P0 风险，不允许 Conditional Close）

**3. 发布治理流程完整实现**

- **自动化验证**:
  - 发布治理流程测试脚本
- **人工验证**:
  - Checklist: 发布治理流程检查
  - 发布治理流程端到端验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS（P0 风险，不允许 Conditional Close）

**4. 监控与告警完整实现**

- **自动化验证**:
  - 监控与告警测试脚本
  - Metrics 端点验证
- **人工验证**:
  - Checklist: 监控与告警功能检查
  - 监控与告警端到端验证
- **Close 判定**: 所有自动化验证 PASS AND 人工验证 PASS

**5. 自动化验证脚本全部通过**

- **验证方式**: 运行所有 Stage 4 自动化验证脚本
- **Close 判定**: 所有脚本 PASS

**6. 人工验证 Checklist 全部 PASS**

- **验证方式**: 完成 `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md` (Stage 4 部分)
- **Close 判定**: 所有 Checklist 项 PASS，执行人已签名

#### Stage 4 总体 Close 判定

**Close = 所有 DoD 项（1-6）全部 Close**

- ✅ 任一 DoD 项未 Close → Stage 4 NOT CLOSE
- ✅ Stage 4 Close = 全量上线 Close

---

## 七、必须产出的正式文件（落仓库）

在"全量上线开发"过程中，仓库内**必须存在并持续更新**：

1. **`docs/LAUNCH_STANDARD_V1.1.md`** (本文档)
   - 上线标准 + Stage DoD + 验证规则

2. **`docs/FULL_LAUNCH_GAP_REPORT.md`**
   - 对照所有官方文档的差距清单
   - 每条标注：自动化验证 / 人工验证 / 风险等级

3. **`docs/FULL_LAUNCH_EXECUTION_PLAN.md`**
   - 按 Stage 拆解的执行计划
   - 每个任务包包含：文件清单 / 回滚方案 / 自动化验证 / 人工验证 / Close 判定方式

4. **`docs/templates/AUTOMATION_VERIFICATION_REPORT.md`**
   - 自动化验证报告模板

5. **`docs/templates/MANUAL_VERIFICATION_CHECKLIST.md`**
   - 人工验证 Checklist 模板

---

## 八、Cursor 的唯一执行模式（最终锁死版）

Cursor 必须严格按以下模式工作：

### MODE: RESEARCH

- → 只读代码与文档，盘点差距，产出报告
- → 禁止修改代码

### MODE: PLAN

- → 拆解到可执行任务包
- → 明确验证方式与 Close 条件
- → 等用户确认
- → 禁止执行代码修改

### MODE: EXECUTE

- → 仅按已确认计划修改
- → 不得越界、不自创
- → 禁止跨 Stage 修改

### MODE: REVIEW

- → 跑自动化验证
- → 提交人工验证 Checklist
- → 给出 Close / Not Close 结论

**任何跳步，均视为违规。**

---

## 九、一句总裁级总结（帮你定心）

**你现在做的不是"把功能补齐再上线"，而是：**

**把一个 AI 系统，从"能跑"，拉到"可以承载真实业务、真实用户、真实风险"的级别。**

**你要求的：**

- ✅ 全功能
- ✅ 全验证
- ✅ 再上线

**在工程上是最难的路，但也是唯一不会反噬你的路。**

---

## 附录：文档引用

- **DBSpec V1.1**: `docs/_specs/...` (待确认具体路径)
- **APISpec V1.1**: `docs/_specs/...` (待确认具体路径)
- **差距报告**: `docs/FULL_LAUNCH_GAP_REPORT.md`
- **执行计划**: `docs/FULL_LAUNCH_EXECUTION_PLAN.md`
- **验证模板**: `docs/templates/`

---

**文档维护**: 任何修改本文档的行为，必须经过 Stage 4 Close 后的正式变更流程。
