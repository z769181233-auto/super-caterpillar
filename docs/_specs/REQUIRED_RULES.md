# REQUIRED_RULES

以下规则为强制执行项，每条规则都必须可追溯到 `docs/_specs/INDEX.md` 中的真实规范文件。

1. 所有规范变更必须同步更新索引。来源：CORE_DOC_GATE_SPEC_V1.md
2. 禁止在主线保留任何 TEMP 规范文件。来源：CORE_DOC_GATE_SPEC_V1.md
3. INDEX 的 Files 仅允许真实规范文件名，System Files 必须单独列出。来源：CORE_DOC_GATE_SPEC_V1.md
4. REQUIRED_RULES 必须包含不少于 10 条带“来源：”的规则。来源：CORE_DOC_GATE_SPEC_V1.md
5. “来源：”引用必须使用 INDEX 中存在的真实文件名（禁止随意写）。来源：CORE_DOC_GATE_SPEC_V1.md
6. doc_gate 作为提交前/合并前闸门，失败必须阻断推进。来源：CORE_DOC_GATE_SPEC_V1.md
7. 新增规范文件必须为可执行/可验收的真实规范，禁止空壳。来源：CORE_DOC_GATE_SPEC_V1.md
8. 删除规范文件前必须确认 INDEX/REQUIRED_RULES 不再引用该文件。来源：CORE_DOC_GATE_SPEC_V1.md
9. 规范文件名必须稳定可引用（避免频繁改名造成来源断链）。来源：CORE_DOC_GATE_SPEC_V1.md
10. 任何破坏索引一致性的变更都视为闸门失败。来源：CORE_DOC_GATE_SPEC_V1.md
