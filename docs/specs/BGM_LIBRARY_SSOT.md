# BGM_LIBRARY_SSOT.md - BGM Selection & Metadata Contract

> **Status**: SEALED (P18-4)
> **Version**: v1.0.0
> **Logic**: Weighted Deterministic Selection

## 1. Track Library (V1)

| Track ID | Name | Style | Default Gain | Loop Strategy | Weight |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `bgm_001_cine` | Cinematic Ambient | Orchestral | -12dB | Crossfade | 1 |
| `bgm_002_lofi` | Lo-Fi Beat | Chillhop | -15dB | Loop | 1 |
| `bgm_003_fast` | Fast Pace | Electronic | -18dB | Loop | 1 |

## 2. Selection Contract (P18-4.2)

- **Algorithm**: `index = weighted_pick(hash(seed), tracks[])`
- **Audit Signals**: Every BGM generation MUST record:
    - `bgm_track_id`: The selected ID from the table above.
    - `bgm_library_version`: `v1.0.0`
    - `bgm_selection_seed`: The raw seed used.

## 3. Storage & Access
- Initial implementation: BGM files are generated via `DeterministicBgmProvider` logic but mapped to these IDs.
- Future: BGM files will be served from a fixed asset bucket.

## 4. Selection Logic Guard
- If library is updated, `bgm_library_version` MUST be incremented to prevent audit inconsistency when rerunning with same seed.
