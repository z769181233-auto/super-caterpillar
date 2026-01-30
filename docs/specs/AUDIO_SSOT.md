# AUDIO_SSOT.md - Audio Engine Single Source of Truth

> **Status**: LIVE (P21-0)
> **Owner**: Audio Team / Gemini
> **Gate**: `gate-audio-p21-0-ops.sh` (P21-0)
> **Seal Tag**: `seal/p21_0_audio_ops_integration_20260124`

## 1. Providers

| Provider Key  | Type | Description                                                          | Use Case                 |
| :------------ | :--- | :------------------------------------------------------------------- | :----------------------- |
| `stub_wav_v1` | STUB | Deterministic sine/noise WAV generation via FFMpeg. No external API. | Gate, Audit, Default     |
| `real_tts_v1` | REAL | External TTS API (e.g. OpenAI/ElevenLabs).                           | Production (Whitelisted) |
| `byo_audio`   | REAL | Import existing audio file (Asset ID).                               | Production               |

## 2. Output Specification

- **Container**: WAV (Initial), MP3 (Final Delivery)
- **Mixer**: `ffmpeg_mix_v1` (Voice + BGM + Ducking + FadeIn/Out)
- **Sample Rate**: 44.1kHz / 48kHz
- **Channels**: Stereo (2.0)

## 3. Audit Signals (Asset Meta)

All audio assets MUST record:

- `audio_file_sha256`: Hash of the physical file.
- `duration_ms`: Precise duration in milliseconds.
- `provider`: `stub_wav_v1` | `real_tts_v1` | `byo_audio`
- `audio_mode`: `legacy` (if Kill Switch ON) vs `real`
- `algo_version`: Version string.
- `kill_switch`: `true` (if ON), `false` (if OFF)
- `audio_vendor`: e.g. `openai`, `elevenlabs`, `mock_vendor`
- `audio_vendor_request_id`: Vendor-provided request identifier.
- `audio_vendor_latency_ms`: Vendor API response time.
- `audio_model`: Model string used (e.g. `tts-1-hd`).

## 4. Kill Switch (0-Risk)

Env: `AUDIO_REAL_FORCE_DISABLE=1`
(Checked at Upper Service Entry)

**When ON**:

- Forced Provider: `stub_wav_v1`
- Signal: `audio_kill_switch=true`, `audio_kill_switch_source=env`.
- Real Signals: SILENCED.

## 5. Workflow

1. **TTS/Input**: Generate/Fetch raw voice track.
2. **Audio Mixing (VideoMerge)**:
   - Input: Voice Track + BGM Track
   - Logic: BGM Loop to Voice Length, Ducking, Fade In/Out.
   - Output: Final Mixed Audio Track.
3. **Persistence**: Write to `Assets` table.

## 6. Gate Requirements

- **Double PASS**: Two runs must produce IDENTICAL `audio_file_sha256` for `stub_wav_v1`.
- **Mixing Verification**: Output duration must match logic (Voice length + padding).
- **Evidence**: `docs/_evidence/p18_0_audio_minloop_1769272440`

## 7. Production Job Routing (P18-1)

| Trigger           | Condition                        | Action                                               |
| :---------------- | :------------------------------- | :--------------------------------------------------- |
| `Kill Switch ON`  | `AUDIO_REAL_FORCE_DISABLE=1`     | Force `stub_wav_v1` + `audio_mode: legacy`           |
| `Not Whitelisted` | `Project.audioRealEnabled=false` | Force `stub_wav_v1` + `audio_mode: stub`             |
| `Whitelisted`     | `Project.audioRealEnabled=true`  | Route to `real_tts_v1` (if enabled) or `stub_wav_v1` |

### Integration Point (Worker)

File: `apps/workers/src/processors/timeline-render.processor.ts`
Sub-Step: `Stage 1.5: Preparing audio assets`

**Workflow**:

1. Check Environment Variable for Kill Switch.
2. Check DB `Project.settingsJson` for `audioRealEnabled` / `audioBgmEnabled`.
3. Call `AudioService.generateAndMix`.
4. Persist Asset with FULL audit metadata.

## 8. Real Provider Contract (P18-2)

### Fail-Fast Path

If `real_tts_v1` is selected but `AUDIO_VENDOR_API_KEY` is missing:

- **Action**: Throw `NOT_CONFIGURED` error.
- **Rule**: DO NOT silent fallback to stub.

### Kill Switch Silence

When `AUDIO_REAL_FORCE_DISABLE=1`:

- **Strict Rule**: Zero external API calls allowed.
- **Verification**: Gate `T1` must assert `external_call_count == 0`.

## 9. Multi-track Asset Contract (P18-3.0)

All assets persisting to the DB must match these audit standards:

| Field          | Voice (TTS)        | BGM (Deterministic)    | Mixed Audio               |
| :------------- | :----------------- | :--------------------- | :------------------------ |
| `type`         | `AUDIO_TTS`        | `AUDIO_BGM`            | `AUDIO_MIXED`             |
| `sha256`       | Required           | Required               | Required                  |
| `duration_ms`  | Required           | Required               | Required                  |
| `provider`     | `stub` \| `real`   | `deterministic_bgm_v1` | `ffmpeg_mixer_v1`         |
| `mode`         | `legacy` \| `real` | `stub` \| `real`       | `prod`                    |
| `mixer_params` | N/A                | N/A                    | `gain`, `ducking`, `fade` |
| `vendor_id`    | Required (if real) | N/A                    | N/A                       |

### Deterministic BGM (P18-3.1)

- **Input**: `bgm_seed` (String)
- **Logic**: Select index from `BGM_LIBRARY` + Hash-based duration padding.
- **Rule**: Same seed MUST produce same `audio_file_sha256`.

### Mix Hardening (P18-3.2)

- **Ducking**: `sidechaincompress=threshold=0.08:ratio=15:attack=0.1:release=1.2`
- **Fade**: `afade=t=in:d=0.5`, `afade=t=out:st=end-0.5:d=0.5`

## 10. Multi-Library Routing (P18-5.0)

To support diverse branding and content styles, the engine supports routing to specific BGM libraries.

### Routing Priority

1. **Force Library (Debug)**: Env `AUDIO_BGM_LIBRARY_ID_OVERRIDE`
2. **Project Setting**: `Project.settingsJson.audioBgmLibraryId`
3. **Default**: `v1.0.0` (Standard)

### Library IDs

- `bgm_lib_v1`: Standard (Sealed in P18-4)
- `bgm_lib_v2_com`: Commercial / High-Energy (Experimental)
- `bgm_lib_v3_cin`: Cinematic / Orchestral (Experimental)

### Style Hinting (Future)

Keywords in `AudioGenerateRequest.text` may influence the library selection if `audioBgmLibraryId` is set to `auto`.
