# SECURITY_PIPELINE.md - Super Caterpillar 安全流水线

本文件定义了项目在 GitHub Actions 上的 **SLSA Level 3** 供应链安全防护机制。

## 1. 核心门禁 (Required Checks)
以下流水线必须在合并至 `main` 分支前通过：
- **ci**: 验证 Monorepo 构建与单元测试。
- **security-scan**: 执行 `pnpm audit` 与 `osv-scanner` (CVE 扫描)。
- **codeql**: 代码静态分析安全扫描。

## 2. 供应链证据 (Supply Chain Evidence)
- **SBOM**: 每次主分支推送均自动生成 CycloneDX 1.6 格式的软件清单。
- **Signing**: 发布 Tag 时，制品通过 Sigstore Cosign 进行 OIDC Keyless 签名。
- **Provenance**: 使用 SLSA Github Generator 生成制品溯源证明。

## 3. 发布流程
1. **本地**: 完成代码开发与测试。
2. **提交**: Push / PR 触发基础门禁。
3. **发布**: 打标签 `v*` (如 `v1.0.0`) 触发制品签名与 SLSA 溯源流程。

## 4. 应急回滚
若需紧急停用流水线限制：
1. 在仓库设置中暂时取消 Branch Protection 的 Required 勾选。
2. 删除 `.github/workflows/` 下对应的 `.yml` 文件并推送。

---
**Status**: ACTIVE / SLSA-Level-3-Ready
**Updated**: 2026-03-04
**Audit**: docs/_evidence/security/
