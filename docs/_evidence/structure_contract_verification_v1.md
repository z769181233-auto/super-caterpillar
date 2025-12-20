# Structure Contract Verification v1

**Verification Date**: 2025-12-20
**Database**: scu_smoke
**Test Project**: Demo Structure Project

## Modified Files (This Refinement Task)
- `tools/smoke/verify_structure_contract.sh` (Unified auth: ensure_auth_state.ts + .auth_env)
- `docs/_evidence/structure_contract_verification_v1.md` (Evidence refinement only)

> Note: `tools/smoke/verify_structure_contract.ts`, `tools/smoke/run_all.sh`, `tools/smoke/seed_demo_structure.ts` are dependencies used by the verification flow but were **not modified** in this refinement task.
---

## Response JSON Sample

**Endpoint**: `GET /api/projects/:id/structure`

```json
{
  "projectId": "0aaaadad-f26b-4139-b05b-2ad0ef4bc9b4",
  "projectName": "Demo Structure Project",
  "projectStatus": "in_progress",
  "tree": [
    {
      "type": "season",
      "id": "aa3d1ba1-8a87-4371-9f24-84a166e07a43",
      "index": 1,
      "title": "Season 1",
      "episodes": [
        {
          "type": "episode",
          "id": "08a9823c-0726-49c0-84a6-a535a889a6b4",
          "seasonId": "aa3d1ba1-8a87-4371-9f24-84a166e07a43",
          "index": 1,
          "name": "Episode 1",
          "scenes": [
            {
              "type": "scene",
              "id": "...",
              "episodeId": "08a9823c-0726-49c0-84a6-a535a889a6b4",
              "index": 1,
              "title": "Scene 1-1",
              "shots": [
                {
                  "type": "shot",
                  "id": "...",
                  "sceneId": "...",
                  "index": 1,
                  "title": "Shot 1-1-1"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "counts": {
    "seasons": 1,
    "episodes": 2,
    "scenes": 6,
    "shots": 30
  },
  "statusSummary": {
    "analysis": "PENDING"
  }
}
```

---

## Counts Validation

| Level | Expected | Actual | Status |
|-------|----------|--------|--------|
| Seasons | 1 | 1 | ✅ |
| Episodes | 2 | 2 | ✅ |
| Scenes | 6 | 6 | ✅ |
| Shots | 30 | 30 | ✅ |

**Formula**: 1 Season × 2 Episodes × 3 Scenes × 5 Shots = 30 Shots

---

## Tree Depth Validation

```
Root
└── Season 1 (index=1, title="Season 1")
    ├── Episode 1 (index=1, name="Episode 1")
    │   ├── Scene 1-1 (index=1, title="Scene 1-1")
    │   │   ├── Shot 1-1-1
    │   │   ├── Shot 1-1-2
    │   │   ├── Shot 1-1-3
    │   │   ├── Shot 1-1-4
    │   │   └── Shot 1-1-5
    │   ├── Scene 1-2 (index=2, title="Scene 1-2")
    │   │   └── [...5 shots]
    │   └── Scene 1-3 (index=3, title="Scene 1-3")
    │       └── [...5 shots]
    └── Episode 2 (index=2, name="Episode 2")
        ├── Scene 2-1 (index=1, title="Scene 2-1")
        │   └── [...5 shots]
        ├── Scene 2-2 (index=2, title="Scene 2-2")
        │   └── [...5 shots]
        └── Scene 2-3 (index=3, title="Scene 2-3")
            └── [...5 shots]
```

**Tree Depth**: 4 levels (Season → Episode → Scene → Shot)

---

## Smoke Gate Validation Checklist

### Hard Gate 1: Counts Non-Zero
- [x] `counts.seasons > 0`
- [x] `counts.episodes > 0`
- [x] `counts.scenes > 0`
- [x] `counts.shots > 0`

### Hard Gate 2: Tree Depth = 4
- [x] `tree[0].episodes` exists and non-empty
- [x] `tree[0].episodes[0].scenes` exists and non-empty
- [x] `tree[0].episodes[0].scenes[0].shots` exists and non-empty

### Optional Manual Check: Frontend Does Not Call List Endpoints

This is **NOT** a hard gate in CI, because it requires browser DevTools evidence.

- [ ] Structure view ONLY calls `/api/projects/:id/structure` (manual DevTools Network screenshot required)
- [ ] No direct calls to:
  - `/api/projects/:id/episodes`
  - `/api/projects/:id/scenes`
  - `/api/projects/:id/shots`

Evidence: user-provided screenshots / DevTools capture.

---

## Verification Commands

### Full Smoke Test
```bash
cd /path/to/Super\ Caterpillar
SMOKE_DB_MODE=reset JWT_SECRET=smoke_jwt_secret_dev_only_change_me bash tools/smoke/run_all.sh
```

### Structure Contract Only
```bash
JWT_SECRET=smoke_jwt_secret_dev_only_change_me bash tools/smoke/verify_structure_contract.sh
```

### Manual Verification
```bash
# 1. Seed Demo Data
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scu_smoke?schema=public \
pnpm -w exec tsx tools/smoke/seed_demo_structure.ts

# 2. Get Project ID
source tools/smoke/.demo_env
echo $TEST_PROJECT_ID

# 3. Verify Contract
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scu_smoke?schema=public \
pnpm -w exec tsx tools/smoke/verify_structure_contract.ts "$TEST_PROJECT_ID"
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All gates passed |
| 1 | At least one gate failed |

**Failure Modes**:
- Counts contain zero: `exit 1`
- Tree depth < 4: `exit 1`
- Missing fields in structure: `exit 1`

---

## Integration Status

- [x] Integrated into `tools/smoke/run_all.sh`
- [x] Runs after auth verification
- [x] Blocks CI on failure
- [x] Idempotent (can run multiple times)

---

## Evidence Collection Date

**Last Verified**: 2025-12-20 00:05 UTC+7
**Verifier**: Smoke Test Suite
**Database**: scu_smoke (PostgreSQL)
**API Version**: Super Caterpillar v1.0

## Verifier Notes (Audit Anchor)

The following commands were executed to confirm repository state and explain cases where `git diff` may be empty (e.g., changes already committed or working tree clean):

- `git rev-parse --show-toplevel`
- `git status`
- `git log -1 --name-only`
- `git diff --stat`

Paste outputs below (timestamped):

2025-12-20T08:11:52+07:00

=== git rev-parse --show-toplevel ===
/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar

=== git status ===
On branch fix/smoke-p0-nonce-crud
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   docs/_evidence/structure_contract_verification_v1.md
	modified:   tools/smoke/verify_structure_contract.sh

=== git log -1 --name-only ===
commit b84f06be7b4cb517dbad837bf0b472b59b85b1ac (HEAD -> fix/smoke-p0-nonce-crud, master)
Author: adamzhaom01-maker <adam.zhaom01@gmail.com>
Date:   Fri Dec 19 11:04:59 2025 +0700

    docs: add remaining Phase A required documentation files

docs/FULL_LAUNCH_EXECUTION_PLAN.md
docs/FULL_LAUNCH_GAP_REPORT.md
docs/LAUNCH_STANDARD_V1.1.md

=== git diff --stat ===
 docs/DEPRECATION_INDEX.md        |  8 ++
 .../check_canonical_workspace.sh |  6 +-
 ...ion_phaseA_20251219_080136.md | 23 ++++
 ...ion_phaseA_20251219_080136.md | 27 ++++-
 ...eprecation_phaseA_20251219.md | 63 +++++++----
 ...an_canonical_only_20251219.md |  3 +
 ...an_canonical_only_20251219.md |  3 +
 7 files changed, 109 insertions(+), 24 deletions(-)
