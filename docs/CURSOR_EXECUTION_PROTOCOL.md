# Cursor 执行协议（Execution Protocol）

**生效日期**: 2025-12-18  
**状态**: 🔒 **强制执行**

---

## 一、唯一标准文档

**《超级毛毛虫宇宙 · 全量上线执行与验证总纲（Unified Launch & Close Spec）》**

**文档位置**: `docs/LAUNCH_STANDARD_V1.1.md`

**规则**: 
- ✅ **以后只认这一份**
- ✅ 任何偏离此文档的行为，均视为违规实现
- ✅ Cursor 在进行任何代码修改前，必须完整阅读并严格遵守此文档

---

## 二、Cursor 的唯一执行模式（行为协议）

Cursor 必须严格按以下模式工作，**任何跳步，均视为违规**：

### MODE: RESEARCH
- → 只读代码与文档，盘点差距，产出报告
- → **禁止修改代码**

### MODE: PLAN
- → 拆解到可执行任务包
- → 明确验证方式与 Close 条件
- → **等用户确认**
- → **禁止执行代码修改**

### MODE: EXECUTE
- → 仅按已确认计划修改
- → 不得越界、不自创
- → **禁止跨 Stage 修改**

### MODE: REVIEW
- → 跑自动化验证
- → 提交人工验证 Checklist
- → 给出 Close / Not Close 结论

---

## 三、违反规则 = 错误实现

**任何违反以下规则的行为，均视为错误实现：**

1. ❌ 跳过 RESEARCH 直接进入 PLAN
2. ❌ 跳过 PLAN 直接进入 EXECUTE
3. ❌ 在 RESEARCH/PLAN 模式下修改代码
4. ❌ 跨 Stage 修改代码
5. ❌ 未按已确认计划执行
6. ❌ 未完成自动化验证就 Close
7. ❌ 未完成人工验证就 Close
8. ❌ 未满足"自动化 + 人工验证"就 Close

---

## 四、当前执行状态

**当前模式**: MODE: RESEARCH

**当前任务**: 对照所有官方文档，产出正式文档

**已完成文档**:
- ✅ `docs/LAUNCH_STANDARD_V1.1.md` - 全量上线标准
- ✅ `docs/FULL_LAUNCH_GAP_REPORT.md` - 差距报告
- ✅ `docs/FULL_LAUNCH_EXECUTION_PLAN.md` - 执行计划
- ✅ `docs/templates/AUTOMATION_VERIFICATION_REPORT.md` - 自动化验证模板
- ✅ `docs/templates/MANUAL_VERIFICATION_CHECKLIST.md` - 人工验证模板

**下一步**: 等待用户确认后，进入 MODE: PLAN

---

**协议维护**: 任何修改本协议的行为，必须经过 Stage 4 Close 后的正式变更流程。

