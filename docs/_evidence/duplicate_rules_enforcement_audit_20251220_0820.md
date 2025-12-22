# Duplicate Rules Enforcement Audit

**Audit Date**: 2025-12-20
**Verifier**: Manual Audit via `tools/smoke/guard/no_duplicate_impls.ts`
**Repo Root**: `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar`

---

## 1. Rule Identification

**Entrance Script**: `tools/smoke/run_all.sh` (Line 186)
**Implementation**: `tools/smoke/guard/no_duplicate_impls.ts`

**Enforced Rules**:
1. `tools/smoke/helpers/worker_min_flow.ts`: `export async function runWorkerMinFlow` (Exactly 1 occurrence)
2. `tools/smoke/stage1_stage2_smoke.ts`: `import ... { checkHealth }` (Exactly 1 occurrence)
3. `tools/smoke/stage1_stage2_smoke.ts`: `async function main(` (Exactly 1 occurrence)

---

## 2. Reproduction Evidence

**Action**: Manually injected duplicate function into `tools/smoke/helpers/worker_min_flow.ts`.

```typescript
// DUPLICATE INJECTION FOR AUDIT
export async function runWorkerMinFlow() { console.log("Duplicate"); }
```

**Command**: `pnpm -w exec tsx tools/smoke/guard/no_duplicate_impls.ts`

**Result**:
```text
[GUARD] ❌ tools/smoke/helpers/worker_min_flow.ts
  Pattern: /export\s+async\s+function\s+runWorkerMinFlow/g
  Expected: 1 occurrence(s)
  Actual: 2 occurrence(s)
Exit code: 1
```

**Status**: ✅ **CAUGHT** (Rule is active and blocking)

---

## 3. Integration Check

**Script**: `tools/smoke/run_all.sh`

```bash
# 1. Guard: 防止重复实现
echo "1. Guard: 检查重复实现..."
if ! pnpm -w exec tsx tools/smoke/guard/no_duplicate_impls.ts; then
  echo "❌ Guard check failed"
  exit 1
fi
echo "✅ Guard check passed"
```

**Conclusion**: The duplicate rule is strictly enforced in `run_all.sh` as a hard gate (exit 1 on failure).

---

## 4. Final State

- Test injection reverted.
- working tree clean.
