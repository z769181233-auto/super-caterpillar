# POST-SEALED 治理封存宣言 (GOVERNANCE SEAL MANIFEST)

> **版本**：1.0.0
> **状态**：SEALED (封存)
> **适用范围**：Super Caterpillar 全量工程治理

## 1. 验收裁决 (Final Decision)

本治理体系的合法性建立在以下四项硬指标之上：

- **单入口聚合**: 所有治理审计必须通过 `tools/gate/gates/gate-post_sealed_governance.sh` 触发。
- **正负双向验证**: 必须同时通过正向红线审计与 `negative_tests.sh` 暴力注入拦截。
- **不可篡改证据**: 每次运行必须在 `docs/_evidence/` 下生成包含 SHA-256 签名及 Git/Runner 元数据的 `EVIDENCE_INDEX.json`。
- **物理流程锁死**: `.husky/pre-push` 必须强制调用聚合门禁，任何 HUSKY=0 的绕过行为均被视为治理事故。

## 2. 不可回退条款 (Anti-Downgrade)

- **环境安全基线**: 禁止移除或篡改 `set -euo pipefail` 与 `IFS=$'\n\t'`。
- **配置驱动**: 审计脚本严禁硬编码逻辑参数，所有口径必须通过 `gov_post_sealed.config.json` 获取。
- **自审计自愈**: 聚合门禁必须保持对自身的反撇号 (Backtick) 扫描与诚信审计。

## 3. 证据追责字段

审计索引必须包含：

- `git_commit` / `git_branch`: 锚定代码版本。
- `runner`: 生产环境指纹及 Node 运行时版本。
- `config_sha256`: 封存配置本身的指纹校验。
- `negative_tests`: 拦截有效性状态。

## 4. 交付 Tag 规范

封存版本必须附带 `seal/post_sealed_governance_<TS>` 标签，确保历史证据与代码版本强关联。
