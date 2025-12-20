# Unused Models Audit Report
**Date:** 2025-12-17
**Stage:** 4 (Audit & Reporting)

This document tracks the usage status of Prisma models to inform future cleanup (Stage 5+).
**Status definitions:**
*   **USED**: active in current production logic.
*   **POSSIBLY UNUSED**: referenced only in tests/scripts or legacy paths.
*   **UNUSED**: No active references found, safe candidate for archival/deletion.

## Core Domain (Active)
| Model | Status | Evidence | Notes |
| :--- | :--- | :--- | :--- |
| **Project** | USED | `project.service.ts` | Core root entity |
| **Scene** | USED | `scene-graph.service.ts` | Core content unit |
| **Shot** | USED | `shot-director.service.ts` | Core atomic unit |
| **Asset** | USED | `job.service.ts` | Result storage (New Stage 4) |
| **Task** | USED | `task.service.ts` | Platform task system |
| **ShotJob** | USED | `job.service.ts` | Worker job unit |
| **AuditLog** | USED | `project.service.ts` | New audit system |
| **BillingEvent**| USED | `billing.service.ts` | Cost tracking |

## Legacy / Compatibility (Do Not Delete)
| Model | Status | Evidence | Notes |
| :--- | :--- | :--- | :--- |
| **Season** | USED | `project.service.ts` | Required for industrial hierarchy (compatibility) |
| **Episode** | USED | `project.service.ts` | Required for industrial hierarchy (compatibility) |
| **EngineTask** | USED | `engine-task.service.ts` | Legacy engine integration (migrating to Task) |

## Infrastructure (Active)
| Model | Status | Evidence | Notes |
| :--- | :--- | :--- | :--- |
| **User** | USED | `auth.module.ts` | Identity |
| **Organization**| USED | `auth.module.ts` | Multi-tenant root |
| **WorkerNode** | USED | `worker.service.ts` | Worker management |
| **NonceStore** | USED | `nonce.service.ts` | API Security |

## Audit Candidates (Possibly Unused)
| Model | Status | Evidence | Action Recommendation |
| :--- | :--- | :--- | :--- |
| **AuditLogLegacy**| **UNUSED** | Marked `@@ignore` in schema | **ARCHIVE** in Stage 5 |
| **ModelRegistry** | POSSIBLY UNUSED | Scanned in Scripts, no active Service found in `apps/api/src` | Check `worker` app usage before delete |
| **TemplatePreset**| POSSIBLY UNUSED | No direct service usage found | Check frontend usage |
| **WorkerHeartbeat**| USED | `worker.service.ts` | Keep (Stage 2 feature) |
| **CostCenter** | POSSIBLY UNUSED | `Organization` relation exists but logic sparse | Future feature? |
| **Subscription** | POSSIBLY UNUSED | `billing` module but logic sparse | Future feature? |

## Tech Debt Notes
*   **AuditLogLegacy**: Explicitly replaced by `AuditLog`. Safe to clean up.
*   **ModelRegistry**: Seems to be a placeholder for future model management. Recommend keeping as "Reserved".
