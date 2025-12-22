# Lint Debt Backlog

**Generated At**: 2025-12-17
**Scope**: `src/components/_legacy`
**Total Violations**: 30+ (Estimated)

> [!WARNING]
> This directory is **FROZEN**. No feature development is allowed here.
> To modify a component, you must first **MIGRATE** it back to `src/components` and fix all lint errors.

## High Priority (Type Safety)

| Component | Rule | Count | Strategy | Est. |
| :--- | :--- | :--- | :--- | :--- |
| `ShotEditor.tsx` | `no-explicit-any` | 1 | Define `Job` or `Result` interface. | S |
| `CapabilitiesSection.tsx` | `no-explicit-any` | 1 | Define `Link` type for landing content. | S |
| `PersonaSection.tsx` | `no-explicit-any` | 1 | Define `Link` type for landing content. | S |
| `ContentList.tsx` | `no-explicit-any` | 2 | Type `data` prop more strictly. | M |

### Resolved (Week 3)
| Component | Status | Fixes |
| :--- | :--- | :--- |
| `DetailPanel.tsx` | ✅ Migrated | Moved to `src/components/project`. Replaced `any` with `@scu/shared-types`. |

### Resolved (Week 2)
| Component | Status | Fixes |
| :--- | :--- | :--- |
| `EngineProfilePanel.tsx` | ✅ Migrated | Moved to `src/components/engines`. Fixed unused imports. |
| `EngineSummaryPanel.tsx` | ✅ Migrated | Moved to `src/components/engines`. Fixed `any` catch block. |

### Resolved (Week 1)
| Component | Status | Fixes |
| :--- | :--- | :--- |
| `ProjectCard.tsx` | ✅ Migrated | Moved to `src/components/project`. Fixed unused imports. |
| `UserInfo.tsx` | ✅ Migrated | Moved to `src/components`. Fixed `any` & `catch`. |
| `UserNav.tsx` | ✅ Migrated | Moved to `src/components`. Fixed `any`, `img`, `imports`. |

| `ProjectStructureTree.tsx` | `no-explicit-any` | 3 | Type the API response and map logic. | M |
| `QualityHintPanel.tsx` | `no-explicit-any` | 2 | Type `issues` array. | S |

## Medium Priority (Best Practices)

| Component | Rule | Count | Strategy | Est. |
| :--- | :--- | :--- | :--- | :--- |

| `AnalysisStatusPanel.tsx` | `no-unused-vars` | 1 | Remove unused helper. | XS |

| `ProjectCard.tsx` | `no-unused-vars` | 1 | Remove unused import. | XS |
| `StudioTree.tsx` | `no-unused-vars` | 2 | Remove unused styles. | XS |
| `ProjectEmptyState.tsx` | `no-unused-vars` | 1 | Remove unused import. | XS |

## Remediation Plan (Stage C1)

Pick 2-3 components per week to migrate:
1.  **Week 1**: `ProjectCard`, `UserNav`, `UserInfo` (High visibility, simple).
2.  **Week 2**: `EngineProfilePanel`, `EngineSummaryPanel` (Self-contained).
3.  **Week 3**: `DetailPanel` (Complex, high debt).
