# GitHub Error Master Ledger

## 1. Launch Gates (Required)
*These checks are MANDATORY for merging PR #6. Current status: **FAILING***

| Gate Name | Status | Error Signature | Remote Run ID | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Gate 4 (Video E2E)** | ❌ FAIL | 当前远端状态：FAIL；旧首错 RCA (400 Engine Missing) 已在本地修复链覆盖；待 Wave 1 同步验真 | 22812542314 | Blocked |
| **Gate 3 (Probe)** | ✅ PASS | N/A | 22812542314 | OK |
| **Gate 18b (Seal)** | ✅ PASS | N/A | 22812542314 | OK |
| **CI / Build** | ⚠️ UNSTABLE | Intermittent lint/type errors in shared packages | N/A | Blocked |

## 2. Security Debt (Code Scanning / Dependabot)
*These do not block functional gates but prevent branch merging due to protection rules.*

### CodeQL / Code Scanning
- **Total Alerts**: 53
- **Severities**: High (12), Medium (25), Low (16)
- **Status**: OPEN

### Dependabot
- **Total Pull Requests**: 5
- **Status**: OPEN

## 3. Branch Protection Summary
- **Required Reviews**: 1
- **Required Status Checks**: all `launch-gates-required` entries must pass.
- **Merge Blocked**: YES.

## 4. Recommended Alignment Priority
1. **Wave 1**: Functional Gates (Gate 4 + E2E Chain).
2. **Wave 2**: CI Stability + Remaining Non-Security Checks.
3. **Wave 3**: Security Debt (CodeQL + Dependabot).
