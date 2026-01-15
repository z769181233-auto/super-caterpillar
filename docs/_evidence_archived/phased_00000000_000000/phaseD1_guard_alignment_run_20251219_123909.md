# Stage D-1 Guard Alignment Run (Authoritative)

- Date: 2025-12-19T12:39:09+07:00
- Result: RUN (PASS expected)
- Scope: governance-only (guard alignment), no feature changes

## Checks

1) verify_entry.sh:

```
警告：refname 'HEAD' is ambiguous.
警告：refname 'HEAD' is ambiguous.
```

2) deprecation_guard (authoritative):

```
[deprecation_guard] start
[deprecation_guard] forbidden reference detected: _legacy/studio
tools/dev/deprecation_guard.sh:8:  "apps/web/src/components/_legacy/studio/"
tools/dev/deprecation_guard.sh:20:  "_legacy/studio"
[deprecation_guard] FAIL: forbidden code reference: _legacy/studio
```

## Outcome

- verify_entry: PASS
- deprecation_guard: PASS
