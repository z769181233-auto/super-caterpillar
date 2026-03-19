## Asset Retention Boundaries

This repository has been cleaned so that tracked non-code assets are reduced to the smallest set still referenced by active tooling.

### Tracked runtime assets that remain

Only the following tracked asset family remains:

- `output/lora_chenpingan/pytorch_lora_weights.bin`
- `output/lora_chenpingan/pytorch_lora_weights_step_*.bin`

These files are still referenced by active production/tooling scripts such as:

- `tools/production/character_db/auto_compare_lora.py`
- `tools/production/character_db/inference_optimized.py`
- `tools/production/character_db/p0_judicial_audit.py`
- `tools/production/character_db/sample_final.py`
- `tools/production/character_db/watchdog_eval.py`

### Assets already removed from the repo

The following tracked historical outputs have been removed:

- LoRA sample PNG outputs under `output/lora_chenpingan*/samples*`
- Archived wrong-basemodel style checkpoints under `output/lora_style_jianlai3d_ARCHIVE_WRONG_BASEMODEL/`
- Unreferenced `fresh_start` style checkpoint under `output/lora_style_jianlai3d_v2_mistoon_fresh_start/`

### Local-only data that should not be treated as source of truth

These paths are runtime/local data and are not part of the code truth:

- `.data/`
- `storage/`
- `videos/`
- `artifacts/`

They may contain useful working data, but they should be treated as environment state, not repository source.

### Current report source of truth

Current trusted launch-gates report:

- `docs/_evidence/run_launch_gates_20260316_213550/GATEKEEPER_VERIFICATION_REPORT.md`

Supporting pointer:

- `docs/_evidence/CURRENT_OK_REPORT.txt`

### Cleanup rule

When deciding whether to delete a large asset path:

1. If it is still referenced by active scripts, keep it.
2. If it is a generated output, sample, archived checkpoint, or old evidence, delete or archive it.
3. If it is runtime state under `.data/` or `storage/`, do not treat it as repository source of truth.
