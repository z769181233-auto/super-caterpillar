# CORE_DOC_GATE_SPEC_V1

## 目标
为 `tools/dev/doc_gate.sh` 提供最小但真实的规范文件，使仓库具备可验证的“规范索引 + 来源规则 + 闸门校验”闭环。

## 范围
- 规范文件：`docs/_specs/*.md`（不含 `INDEX.md`、`REQUIRED_RULES.md`、任何 TEMP）
- 索引生成：`tools/dev/gen_specs_index.sh`
- 闸门校验：`tools/dev/doc_gate.sh`

## 约束
1. 必须至少存在 1 个真实规范文件（例如本文件）。
2. `docs/_specs/INDEX.md` 的 Files 列表仅包含真实规范文件名；System Files 单独列出。
3. `docs/_specs/REQUIRED_RULES.md` 至少包含 10 条“来源：”，且来源必须引用 `INDEX.md` 中的真实文件名。
4. 任何 TEMP 文件一旦存在，`doc_gate.sh` 必须失败（用于阻断临时/草稿污染主线）。

## 验收
- `bash tools/dev/gen_specs_index.sh` 执行后，`docs/_specs/INDEX.md` 正确列出本文件。
- `docs/_specs/REQUIRED_RULES.md` 满足来源条数与引用约束。
- `bash tools/dev/doc_gate.sh` 通过。
- `bash tools/smoke/run_all.sh` 通过（或至少推进到与 doc_gate 无关的下一类错误）。
