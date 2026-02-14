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
