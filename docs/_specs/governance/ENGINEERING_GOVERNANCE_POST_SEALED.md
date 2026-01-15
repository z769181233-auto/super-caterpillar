# ENGINEERING_GOVERNANCE_POST_SEALED (SSOT)

本文件是 POST-SEALED 工程治理红线的“人读权威口径”，任何自动化门禁必须以同目录下
gov_post_sealed.config.json 的机器口径为准执行，禁止在脚本中硬编码口径，防止漂移。

## 红线范围

1. 结构红线：目录与证据归档结构不可漂移。
2. Shell 红线：所有 Gate Shell 脚本必须满足安全基座。
3. SQL 注入免疫红线：凡 psql -c 涉及变量/拼接，必须使用 Tagged Dollar-Quoting（默认 $gate$）。

## 强制策略

- 单入口：gate-post_sealed_governance.sh 为唯一聚合入口。
- 自举校验：聚合入口先审计自身及依赖脚本的 Shell 安全。
- 证据索引化：每次运行必须产出 RUN_LOG.txt / SUMMARY.json / EVIDENCE_INDEX.json。
- 本地锁死：.husky/pre-push 必须调用聚合入口，失败则拒绝 push。

## 失败即阻断

任何红线失败：退出码非 0；不得产生“假 PASS”。

## 变更流程

修改口径必须：

- 同时修改 gov_post_sealed.config.json
- 运行 gate-post_sealed_governance.sh 生成新证据
- 更新 task.md / implementation_plan.md 对应条目
