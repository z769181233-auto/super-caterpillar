# SECURITY_PIPELINE.md - Super Caterpillar 安全流水线 (SLSA Level 3)

本文件定义了项目在 GitHub Actions 上的 **SLSA Level 3** 供应链安全防护机制。

## 1. 核心门禁 (Required Checks)
以下流水线必须在合并至 `main` 分支前通过：
- **ci**: 验证 Monorepo 构建。引入 Postgres Service 实现数据库操作的自洽验证。
- **security-scan**: 执行 `pnpm audit` 100% 生产清零、与 `osv-scanner` (v2.3.3) CVE 同步扫描。
- **codeql**: 代码静态分析安全扫描。

## 2. 软件清单与制品证明 (Artifact & Provenance)
- **SBOM**: 每次主分支推送均自动执行 `cyclonedx-npm` 生成 CycloneDX 1.6 格式清单，并通过 `cyclonedx-cli` 审计校验。
- **Signing**: 发布 Tag 时，通过 **Sigstore Cosign** 启用 OIDC Keyless 签名，确证制品物理来源。
- **Provenance**: 使用 **SLSA Generic Generator** (L3) 生成不可篡改的构建溯源证明。

## 3. 分支保护建议 (Settings)
为确保流水线效力，建议在 GitHub Settings 设置以下门禁：
- 启用 `Require status checks to pass before merging`。
- 将 `ci`, `security-scan`, `codeql` 设置为强制项。

---
**Status**: ACTIVE / Hardened / SLSA-L3
**Updated**: 2026-03-04
**Evidence**: docs/_evidence/security/
认识。
