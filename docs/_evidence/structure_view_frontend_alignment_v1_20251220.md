# Structure View Frontend Alignment Evidence
Date: 2025-12-20

## 1. Goal
Ensure the frontend Structure View strictly aligns with Contract V1.0:
- Single Source of Truth: `GET /api/projects/:id/structure`
- Unified Field Logic: `getNodeTitle` checks `title` ?? `name`.
- NO logic dependencies on Job/Task states for rendering (except status badge).

## 2. Verification Points

### A. Frontend Counts
Aligned with Seed Data (1 Season / 2 Episodes / 6 Scenes / 30 Shots):
- Seasons: 1
- Episodes: 2
- Scenes: 6
- Shots: 30

### B. Network Traffic
- **URL**: `/api/projects/:id/structure`
- **Method**: GET
- **Frequency**: Once on load (polled if status is analyzing).
- **Payload**: None
- **Response**: Contains full nested tree `Season -> Episode -> Scene -> Shot`.

### C. UI Rendering
- Tree Levels: 4 Levels Depth.
- Labels: Uses `title` or fallback to `name`.
- Status: Uses "Industrial Status Badge" for QA/Blocking info.
- **NO** "Generate" or "Analyze" buttons in the tree view (Pure Display).

## 3. Implementation Details
- Component: `apps/web/src/components/project/ProjectStructureTree.tsx`
- Helper: `getNodeTitle = (node) => node.title ?? node.name ?? '(untitled)'`
- API Client: `projectApi.getProjectStructure`

## 4. E2E Validation
- Script: `tools/smoke/run_e2e_vertical_slice.sh`
- Result: Passed (JWT_SECRET injected via start_api.sh).
