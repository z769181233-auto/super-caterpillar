# Baseline Bypass Audit (Pre-Stage-3 Execution)

The following locations contain active bypasses/mocks that must be removed for "Commercial Production Ready" status:

## 1. TimelineCompose Processor
- **File**: `apps/workers/src/processors/timeline-compose.processor.ts`
- **Line ~102**: Commented out `if (scene.shots.length < 2)` guard.

## 2. TimelineRender Processor
- **File**: `apps/workers/src/processors/timeline-render.processor.ts`
- **Line ~100**: Commented out `if (!fs.existsSync(framesTxt))` guard.
- **Line ~107**: Mocked Stage 1 FFmpeg output (`fs.writeFileSync(shotOutputPath, 'mock mp4 content')`).
- **Line ~108**: Commented out `await runFfmpeg(...)`.
- **Line ~146**: Mocked Stage 2 (Path A) output.
- **Line ~284**: Mocked Stage 2 (Path B) output.

## 3. MediaSecurity Processor (CE09)
- **File**: `apps/workers/src/processors/media-security.processor.ts`
- **Logic**: Security operation is currently a mock (file copy) and does not generate real SHA256 fingerprints or HLS playlists.

## 4. Mock Engine
- **File**: `apps/tools/mock-http-engine/server.ts`
- **Logic**: Returning minimum structure (often 1 shot/1 scene) which forced the bypasses above.

## 5. JobService (Orchestration)
- **File**: `apps/api/src/job/job.service.ts`
- **Logic**: Missing `applyAnalyzedStructureToDatabase` call on CE06 completion.
