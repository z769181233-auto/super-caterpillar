# CE Core Runtime Verify Spec

## 目标
- 定义本仓库“全量验证（run_all / smoke / doc gate）”的最小必备契约
- 明确：文档闸门、运行时验证、Hook 安装的前置条件与失败判定

## 范围
- tools/dev/doc_gate.sh
- tools/dev/gen_specs_index.sh
- tools/smoke/run-ce-core-runtime-verify.sh（或 run_all.sh 中对应段）

## 约束
1. 必须在 Git 仓库根目录执行（存在 .git）。
2. docs/_specs 下至少存在 1 个真实规范（本文件）。
3. 禁止 TEMP 规范文件存在。
4. REQUIRED_RULES.md 必须包含 >=10 条“来源：<真实规范文件名>”，且该文件名必须出现在 INDEX.md 的 Files 列表中。

## 验证点
- doc gate：通过
- gen index：INDEX.md 正确列出真实规范
- smoke / run_all：在本地可重复执行
