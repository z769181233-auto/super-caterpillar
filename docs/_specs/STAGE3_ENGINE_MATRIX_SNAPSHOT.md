# Stage-3 Engine Matrix Snapshot (SSOT)

GeneratedAt: 2026-01-08
Scope: CE06 / CE03 / CE04 / ShotRender

## Matrix

| EngineKey              | JobType                | Mode                                | Billing Model    | UnitCost (credits/1k) | Output           | Persistence                     | Gate                                     | Closure Tag                     |
| ---------------------- | ---------------------- | ----------------------------------- | ---------------- | --------------------: | ---------------- | ------------------------------- | ---------------------------------------- | ------------------------------- |
| ce06_novel_parsing     | CE06_NOVEL_PARSING     | Real-Stub (Replay available)        | ce06-replay-mock |                   0.2 | structured parse | DB: Novel\* tables + CostLedger | gate-stage3-b_ce06_billing_closure.sh    | stage3b_ce06_billing_closure    |
| ce03_visual_density    | CE03_VISUAL_DENSITY    | Real (Heuristic)                    | default          |                   1.0 | density score    | DB: QualityMetrics + CostLedger | gate-stage3-c_ce03_density_closure.sh    | stage3c_ce03_density_closure    |
| ce04_visual_enrichment | CE04_VISUAL_ENRICHMENT | Real-Stub (Deterministic Heuristic) | default          |                   1.0 | prompt parts     | DB: QualityMetrics + CostLedger | gate-stage3-d_ce04_enrichment_closure.sh | stage3d_ce04_enrichment_closure |
| shot_render            | SHOT_RENDER            | Real-IO (Deterministic I/O)         | sdxl-turbo-stub  |                  50.0 | asset file       | FS: assets/ + CostLedger        | gate-stage3-e_shot_render_closure.sh     | stage3e_shot_render_closure     |

## Audit Notes

- Real-Stub: Deterministic heuristic output, audit-friendly, replaceable in P1 without changing SSOT/Billing/Gates.
- Real-IO: Produces real assets (files) and high-cost billing; must be protected by quota/limits in P1.
