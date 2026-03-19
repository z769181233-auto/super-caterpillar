## Compatibility Boundaries

This repository has already been cleaned so that most misleading compatibility layers, dead bridges, and fake legacy entry points are removed.

What remains here should be treated as intentional compatibility, not accidental code drift.

### Active compatibility that still remains

- `apps/api/src/project/dto/create-episode.dto.ts`
  - `name` is still accepted as an optional compatibility alias for older callers, while new code should use `title`.
- `apps/api/src/billing/billing.service.ts`
  - `legacyEventType` remains because billing/audit payloads still normalize older event shapes during the transition window.
- `apps/api/src/billing/billing-ledger-compat.util.ts`
  - This file exists to normalize the current physical billing ledger schema into the SSOT-facing shape until a full DB schema migration is completed.
- `apps/api/src/auth/hmac/hmac-auth.guard.ts`
  - `request.user.id` is intentionally duplicated from `userId` to preserve the request shape expected by downstream Nest/Passport-style consumers.
- `packages/shared-types/src/scene-graph.ts`
  - A small number of optional compatibility fields remain so old project payloads can still be read while newer callers move to the `seasons -> episodes` structure.

### Not compatibility debt

The following should not be mistaken for leftover junk:

- `tools/backup/db_backup.sh`
- `tools/backup/db_restore.sh`
- `apps/api/src/scripts/inspect-jobs.ts`
- `output/lora_chenpingan/pytorch_lora_weights.bin`

These are active operational tools or retained runtime assets with current references.

### Cleanup rule

When deciding whether a remaining compatibility marker should be removed:

1. Remove it if it has no active caller or contract responsibility.
2. Keep it only if it preserves a current external/API/tooling contract.
3. If kept, document the reason here so it is not mistaken for dead code later.
