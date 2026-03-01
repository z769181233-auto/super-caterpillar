# RELEASE_POLICY_SSOT (SSOT)

## 0. Scope

This document is the single source of truth for release governance, versioning, changelog requirements, and rollback criteria.

## 1. Versioning

- Version file: /VERSION (SemVer: MAJOR.MINOR.PATCH)
- Tag format: sealed*p{phase}*{name}\_{shortsha} OR v{VERSION} (choose one standard and keep consistent)

## 2. Release Notes (Required)

For every VERSION, a release note must exist:

- docs/releases/<VERSION>.md

Release note must include:

- Summary (what changed)
- Impact analysis (affected components, risk)
- Rollback plan (exact rollback steps)
- Verification evidence pointers (evidence dirs, checksums, tags)

## 3. Rollback Policy (Required)

A release is eligible only if:

- Rollback target is defined (tag/sha)
- Rollback drill evidence exists (Phase 7)
- Post-deploy verification checklist is defined and executable

## 4. Compliance

- No secrets in release notes or evidence
- Evidence must be checksummed and indexed

## 5. Preview Restrictions (Redline)

> [!IMPORTANT]
> **Pages 预览环境局限性声明**:  
> Pages 预览 (v.s. Static Export) 只能证明 UI、路由及前端状态矩阵的连通性。它**严禁**作为 API、Worker、计费链路或审计链完整性的验证依据。任何涉及后端的逻辑漏洞必须在 P9.2B (Staging/Production) 真实环境下闭环。
