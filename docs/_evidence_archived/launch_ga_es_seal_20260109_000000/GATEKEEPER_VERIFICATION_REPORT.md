# 门禁验证报告（全自动真验）

生成时间: 2026-01-09T23:04:19+07:00

## 执行环境

- API URL: http://localhost:3000
- Nginx URL: http://localhost
- Test Storage Key: temp/gates/1767974658/probe.txt
- Auth Token A: <set>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZDMyZTU4YS02YTAyLTRlNjUtYmMwYi02NzViMDY0OWZjN2MiLCJlbWFpbCI6InNtb2tlQGV4YW1wbGUuY29tIiwidGllciI6IkZyZWUiLCJvcmdJZCI6IjAyYmQ1YzJkLWZlNTItNDAwZi04ZjgyLTZiODc2MGQ0ZGIxMiIsImlhdCI6MTc2Nzk3NDY1OCwiZXhwIjoxNzY4NTc5NDU4fQ.h57enaHSIQHsfpdImrho1Gtl-Y--3AVdRUzGG1ZrlTQ
- Auth Token B: <not set>

## 执行摘要

## 详细结果

### Gate 1: Preflight Check + CORS Production Validation

- ✅ API health check passed
  Command: curl -s -f http://localhost:3000/api/health
  Picked: http://localhost:3000/api/health
- ✅ Database connection check passed
  Command: curl -s -f http://localhost:3000/health/ready
  Picked: http://localhost:3000/health/ready
- ✅ Metrics endpoint available
  Command: curl -s -f http://localhost:3000/metrics
- ⚠️ CORS production check skipped (NODE_ENV != production)

### Gate 2: Capacity Gate Negative Tests

- ❌ Capacity query endpoint failed for A (HTTP 404)
  Debug dump (A auth):
  URL: http://localhost:3000/api/jobs/capacity
  HTTP/1.1 404 Not Found
  X-Content-Type-Options: nosniff
  X-DNS-Prefetch-Control: off
  X-Download-Options: noopen
  X-Frame-Options: SAMEORIGIN
  X-Permitted-Cross-Domain-Policies: none
  X-XSS-Protection: 0
  x-trace-id: 0aa8a59c-5e24-463c-9daf-0dddad19b84f
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 92
  X-RateLimit-Reset: 26
  Content-Type: application/json; charset=utf-8

### Gate 3: Signed URL Full Auto Test

- ✅ Direct access rejected (HTTP 404)
  Command: curl -s -w "\n%{http_code}" http://localhost:3000/api/storage/temp/gates/1767974658/probe.txt
  Response Code: 404
- ✅ Signed URL generated successfully
  Command: curl -H "Authorization: Bearer <AUTH_TOKEN_A>" http://localhost:3000/api/storage/sign/temp/gates/1767974658/probe.txt
  Signed URL: http://localhost:3000/api/storage/signed/temp/gates/1767974658/probe.txt?expires=1767978259&tenantId=02bd5c2d-fe52-400f-8f82-6b8760d4db12&userId=8d32e58a-6a02-4e65-bc0b-675b0649fc7c&signature=6f2be7eeca2d6e33aef453d1500fbc7f352012dfcde475fd34164876309eb594
- ❌ Range request failed (HTTP 000, expected 206)
  Command: curl -H "Range: bytes=0-1023" http://localhost/api/storage/signed/temp/gates/1767974658/probe.txt?expires=1767978259&tenantId=02bd5c2d-fe52-400f-8f82-6b8760d4db12&userId=8d32e58a-6a02-4e65-bc0b-675b0649fc7c&signature=6f2be7eeca2d6e33aef453d1500fbc7f352012dfcde475fd34164876309eb594?expires=1767978259&tenantId=02bd5c2d-fe52-400f-8f82-6b8760d4db12&userId=8d32e58a-6a02-4e65-bc0b-675b0649fc7c&signature=6f2be7eeca2d6e33aef453d1500fbc7f352012dfcde475fd34164876309eb594
- ❌ Expired signature not rejected (HTTP 000, expected 404)
- ❌ Tampered signature not rejected (HTTP 000, expected 404)
- ⚠️ Unauthorized access test skipped (AUTH_TOKEN_B not set)

### Gate 4: Video E2E Test

=== Stage 8 Video E2E Test ===
Repo: /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar
Storage: .data/storage
[Env] DATABASE*URL=postgresql://postgres:\*\*\*@localhost:5432/scu?schema=public
[0/4] Initializing API Key...
🔑 Initializing API Key for smoke tests...
Key: scu_smoke_key
Secret: scu_smok...
Ensuring RBAC roles and permissions...
✅ Updated existing API Key: scu_smoke_key (bound to 69cef46a-9f4e-4e97-a030-17f0c2d3eef1, User Role: admin)
✅ Seeded Smoke Project: 00000000-0000-0000-0000-000000000001
Ensuring default engines are registered...
✅ Default engines seeded.
✅ Verified apiKey binding: scu_smoke_key -> user=8d32e58a-6a02-4e65-bc0b-675b0649fc7c org=69cef46a-9f4e-4e97-a030-17f0c2d3eef1
[1/4] Seeding Data...
Shot ID: ddd71e20-ae3e-449e-9588-8ae26a3cf74f
Frames: [
"temp/seed/seed-1767974660593/0.png",
"temp/seed/seed-1767974660593/1.png",
"temp/seed/seed-1767974660593/2.png"
]
[E2E] Assert shot exists in DB (seed DB)...
{
"ok": true,
"shotId": "ddd71e20-ae3e-449e-9588-8ae26a3cf74f",
"organizationId": "69cef46a-9f4e-4e97-a030-17f0c2d3eef1"
}
[E2E] Port 3000 is in use, reusing existing API (E2E_FORCE_RESTART_API=false)
API already running on port 3000; skipping start_api.sh
[E2E] Waiting for API ready...
[wait] http://localhost:3000/api/health/ready -> HTTP 404
[wait] TIMEOUT after 60s: http://localhost:3000/api/health/ready
[wait] http://localhost:3000/health/ready -> HTTP 200
[E2E] API ready ✅
[2/4] Starting Worker App...
Waiting for worker to ready...
[E2E] Worker log fingerprint (first 120 lines)...
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=74801b00... timestamp=1767974724710 workerId=local-worker bodyString=
{"event":"GET_NEXT_JOB_RES","status":200,"jobId":null,"timestamp":"2026-01-09T16:05:24.720Z"}
DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/heartbeat
[Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=7777d536... timestamp=1767974726681 workerId=local-worker bodyString={"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c0e7d4a2... timestamp=1767974726710 workerId=local-worker bodyString=
{"event":"GET_NEXT_JOB_RES","status":200,"jobId":null,"timestamp":"2026-01-09T16:05:26.717Z"}
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=5b7fe633... timestamp=1767974728711 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu_smoke*...',
'X-Nonce': '5b7fe633...',
'X-Timestamp': '1767974728711',
'X-Signature': '5532e565d2390b44...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=31ee17be... timestamp=1767974730710 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu*smoke*...',
'X-Nonce': '31ee17be...',
'X-Timestamp': '1767974730710',
'X-Signature': '18a9390b6cbec950...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0,"capabilities":{"concurrency*managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/heartbeat
[Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=f51c65a0... timestamp=1767974731682 workerId=local-worker bodyString={"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=5713fc27... timestamp=1767974732711 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu_smoke*...',
'X-Nonce': '5713fc27...',
'X-Timestamp': '1767974732711',
'X-Signature': '4462657a991a6c06...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=f2d9f3a4... timestamp=1767974734711 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu*smoke*...',
'X-Nonce': 'f2d9f3a4...',
'X-Timestamp': '1767974734711',
'X-Signature': 'ae5998f7e92cd8b0...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0,"capabilities":{"concurrency*managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/heartbeat
[Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=6fd20d57... timestamp=1767974736684 workerId=local-worker bodyString={"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c2ce80a4... timestamp=1767974736712 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu_smoke*...',
'X-Nonce': 'c2ce80a4...',
'X-Timestamp': '1767974736712',
'X-Signature': '4a014c5ee70cb70c...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=8c7bcc0a... timestamp=1767974738713 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu*smoke*...',
'X-Nonce': '8c7bcc0a...',
'X-Timestamp': '1767974738713',
'X-Signature': '66eb863eab31fd7e...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c8eb76f0... timestamp=1767974740713 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu*smoke*...',
'X-Nonce': 'c8eb76f0...',
'X-Timestamp': '1767974740713',
'X-Signature': '14a91fdd347434cc...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0,"capabilities":{"concurrency*managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/heartbeat
[Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=a8981922... timestamp=1767974741684 workerId=local-worker bodyString={"status":"idle","tasksRunning":0,"capabilities":{"concurrency_managed":true,"lease_supported":true,"supportedEngines":["default_novel_analysis"]}}
[Probe] R=true E=true
[WorkerRuntime] {"jobMaxInFlight":10,"nodeMaxOldSpaceMb":2048,"jobWaveSize":5}
[Worker DEBUG] ApiClient request: POST /api/workers/local-worker/jobs/next
[Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c75032de... timestamp=1767974742714 workerId=local-worker bodyString=
[Worker HTTP Error] POST http://localhost:3000/api/workers/local-worker/jobs/next 429 ThrottlerException: Too Many Requests
[Worker HTTP Error] Headers sent: {
'X-Api-Key': 'scu_smoke*...',
'X-Nonce': 'c75032de...',
'X-Timestamp': '1767974742714',
'X-Signature': '5eaca253b0f08bcb...'
}
[Worker] ❌ 轮询 Job 失败: API request failed: ThrottlerException: Too Many Requests
[3/4] Triggering & Polling...
[Verify] Triggering VIDEO_RENDER for Shot ddd71e20-ae3e-449e-9588-8ae26a3cf74f...
[Verify] Trigger Failed: {
"success": false,
"status": 403,
"response": {
"code": "PAYMENT_REQUIRED",
"message": "Insufficient credits to create job. Please top up.",
"statusCode": 402
},
"requestHeaders": {
"X-Api-Key": "scu_smoke_key",
"X-Nonce": "nonce-1767974743-hr1q9q",
"X-Timestamp": "1767974743",
"X-Signature": "b1eac8ef225f759483500dd819579a738b5d9d0c0996ec1486b50b121f8192b5",
"Content-Type": "application/json",
"X-Content-SHA256": "89bc603113a23cd28977d433e687443e6293f78d313f36075d2718b0f24f6c81"
},
"timestamp": "2026-01-09T16:05:43.972Z"
}

- ❌ Video E2E test failed

### Gate 5: Capacity Report Data Completeness

- ⚠️ Capacity report contains placeholder data, attempting auto-fill...
  Running capacity benchmark and filling report...

🚀 Starting API Load Test (Real Endpoint)...
URL: http://localhost:3000
Endpoint: POST /api/shots/70bd5944-897d-45e8-b2fa-261072b5a910/jobs
Job Type: VIDEO_RENDER
Concurrent: 10
Total Requests: 100

{
"url": "http://localhost:3000",
"endpoint": "POST /api/shots/70bd5944-897d-45e8-b2fa-261072b5a910/jobs",
"jobType": "VIDEO_RENDER",
"concurrent": 10,
"requests": 100,
"total": 100,
"success": 0,
"failed": 100,
"capacityExceeded": 3,
"durationSec": 0.116,
"rps": 862.0689655172413,
"latencyMs": {
"min": 3,
"max": 17,
"avg": 8.73,
"p50": 8,
"p95": 16,
"p99": 17
},
"successRate": 0,
"capacityExceededRate": 0.03,
"threshold": {
"p95Ms": 500,
"successRate": 0.95
},
"pass": false,
"ts": "2026-01-09T16:05:44.165Z"
}

- ❌ Failed to auto-fill capacity report from benchmark

### Gate 6: Video Merge Memory Safety

=== GATE P0-R1 [VIDEO_MERGE_HASH_STREAM] START ===
✅ No readFileSync calls found in provider
Generating 512MB test file at docs/\_evidence/tmp_bigfile_512mb.bin...
Running memory check...
filePath: docs/\_evidence/tmp_bigfile_512mb.bin
digest: 9acca8e8c22201155389f65abbf6bc9723edc7384ead80503839f49dcc56d767
rss_before: 41.14 MB
rss_after: 156.25 MB
rss_delta_mb: 115.11
✅ RSS delta is within safe limits
GATE P0-R1 [VIDEO_MERGE_HASH_STREAM]: PASS

- ✅ Video Merge memory safety check passed

### Gate 7: Video Merge Resource Guardrails

=== GATE P0-R2 [VIDEO_MERGE_GUARDRAILS] START ===
[1/3] Assert spawnWithTimeout kills on timeout (deterministic sleep)...
Starting sleep 5 with 200ms timeout...
[Guardrail] Killing process 13202 due to timeout (200ms)
result: { code: null, stderr: '', timedOut: true }
PASS: timedOut kill works
[2/3] Assert -threads applied via provider log (default=1 and override=2)...
Testing default threads (1)...
video*merge_spawn jobId=p0r2_default ffmpeg_threads=1 timeout_ms=60000 args="-y -framerate 2 -i apps/workers/.runtime/assets_gate_p0r2/temp_seq_p0r2_default/frame*%04d.png -c:v libx264 -pix*fmt yuv420p -threads 1 -vf scale=64:64 apps/workers/.runtime/assets_gate_p0r2/video_merge_p0r2_default.mp4"
Merge failed (likely ffmpeg not found or png invalid), but we only need the log check if it reached spawn.
Error: FFmpeg failed (status 69): ffmpeg version 8.0.1 Copyright (c) 2000-2025 the FFmpeg developers
built with Apple clang version 17.0.0 (clang-1700.4.4.1)
configuration: --prefix=/opt/homebrew/Cellar/ffmpeg/8.0.1 --enable-shared --enable-pthreads --enable-version3 --cc=clang --host-cflags= --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libaribb24 --enable-libbluray --enable-libdav1d --enable-libharfbuzz --enable-libjxl --enable-libmp3lame --enable-libopus --enable-librav1e --enable-librist --enable-librubberband --enable-libsnappy --enable-libsrt --enable-libssh --enable-libsvtav1 --enable-libtesseract --enable-libtheora --enable-libvidstab --enable-libvmaf --enable-libvorbis --enable-libvpx --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxml2 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-libspeex --enable-libsoxr --enable-libzmq --enable-libzimg --disable-libjack --disable-indev=jack --enable-videotoolbox --enable-audiotoolbox --enable-neon
libavutil 60. 8.100 / 60. 8.100
libavcodec 62. 11.100 / 62. 11.100
libavformat 62. 3.100 / 62. 3.100
libavdevice 62. 1.100 / 62. 1.100
libavfilter 11. 4.100 / 11. 4.100
libswscale 9. 1.100 / 9. 1.100
libswresample 6. 1.100 / 6. 1.100
[png @ 0x153004080] inflate returned error -3
Input #0, image2, from 'apps/workers/.runtime/assets_gate_p0r2/temp_seq_p0r2_default/frame*%04d.png':
Duration: 00:00:01.50, start: 0.000000, bitrate: N/A
Stream #0:0: Video: png, rgb24(pc, gbr/unknown/unknown), 1x1, 2 fps, 2 tbr, 2 tbn
Stream mapping:
Stream #0:0 -> #0:0 (png (native) -> h264 (libx264))
Press [q] to stop, [?] for help
[png @ 0x152635170] inflate returned error -3
[png @ 0x1526356a0] inflate returned error -3
[png @ 0x152635c40] inflate returned error -3
[vist#0:0/png @ 0x152632f20] [dec:png @ 0x1530043f0] Decoding error: Generic error in an external library
Last message repeated 2 times
[vist#0:0/png @ 0x152632f20] [dec:png @ 0x1530043f0] Decode error rate 1 exceeds maximum 0.666667
[vist#0:0/png @ 0x152632f20] [dec:png @ 0x1530043f0] Task finished with error code: -1145393733 (Error number -1145393733 occurred)
[vist#0:0/png @ 0x152632f20] [dec:png @ 0x1530043f0] Terminating thread with return code -1145393733 (Error number -1145393733 occurred)
[vf#0:0 @ 0x152634b30] No filtered frames for output stream, trying to initialize anyway.
[libx264 @ 0x1526338d0] using cpu capabilities: ARMv8 NEON DotProd I8MM
[libx264 @ 0x1526338d0] profile High, level 1.0, 4:2:0, 8-bit
[libx264 @ 0x1526338d0] 264 - core 165 r3222 b35605a - H.264/MPEG-4 AVC codec - Copyleft 2003-2025 - http://www.videolan.org/x264.html - options: cabac=1 ref=3 deblock=1:0:0 analyse=0x3:0x113 me=hex subme=7 psy=1 psy_rd=1.00:0.00 mixed_ref=1 me_range=16 chroma_me=1 trellis=1 8x8dct=1 cqm=0 deadzone=21,11 fast_pskip=1 chroma_qp_offset=-2 threads=1 lookahead_threads=1 sliced_threads=0 nr=0 decimate=1 interlaced=0 bluray_compat=0 constrained_intra=0 bframes=3 b_pyramid=2 b_adapt=1 b_bias=0 direct=1 weightb=1 open_gop=0 weightp=2 keyint=250 keyint_min=2 scenecut=40 intra_refresh=0 rc_lookahead=40 rc=crf mbtree=1 crf=23.0 qcomp=0.60 qpmin=0 qpmax=69 qpstep=4 ip_ratio=1.40 aq=1:1.00
Output #0, mp4, to 'apps/workers/.runtime/assets_gate_p0r2/video_merge_p0r2_default.mp4':
Metadata:
encoder : Lavf62.3.100
Stream #0:0: Video: h264 (avc1 / 0x31637661), yuv420p(progressive), 64x64, q=2-31, 2 fps, 16384 tbn
Metadata:
encoder : Lavc62.11.100 libx264
Side data:
cpb: bitrate max/min/avg: 0/0/0 buffer size: 0 vbv_delay: N/A
[out#0/mp4 @ 0x1527042a0] video:0KiB audio:0KiB subtitle:0KiB other streams:0KiB global headers:0KiB muxing overhead: unknown
[out#0/mp4 @ 0x1527042a0] Output file is empty, nothing was encoded(check -ss / -t / -frames parameters if used)
frame= 0 fps=0.0 q=0.0 Lsize= 0KiB time=N/A bitrate=N/A speed=N/A elapsed=0:00:00.00  
Conversion failed!

    at Object.merge (packages/engines/video_merge/providers/local_ffmpeg.provider.ts:134:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async testThreads (tools/gate/gates/helper_p0r2_test.ts:32:22)
    at async <anonymous> (tools/gate/gates/helper_p0r2_test.ts:63:28)

Testing override threads (2)...
video*merge_spawn jobId=p0r2_threads2 ffmpeg_threads=2 timeout_ms=60000 args="-y -framerate 2 -i apps/workers/.runtime/assets_gate_p0r2/temp_seq_p0r2_threads2/frame*%04d.png -c:v libx264 -pix*fmt yuv420p -threads 2 -vf scale=64:64 apps/workers/.runtime/assets_gate_p0r2/video_merge_p0r2_threads2.mp4"
Error: FFmpeg failed (status 69): ffmpeg version 8.0.1 Copyright (c) 2000-2025 the FFmpeg developers
built with Apple clang version 17.0.0 (clang-1700.4.4.1)
configuration: --prefix=/opt/homebrew/Cellar/ffmpeg/8.0.1 --enable-shared --enable-pthreads --enable-version3 --cc=clang --host-cflags= --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libaribb24 --enable-libbluray --enable-libdav1d --enable-libharfbuzz --enable-libjxl --enable-libmp3lame --enable-libopus --enable-librav1e --enable-librist --enable-librubberband --enable-libsnappy --enable-libsrt --enable-libssh --enable-libsvtav1 --enable-libtesseract --enable-libtheora --enable-libvidstab --enable-libvmaf --enable-libvorbis --enable-libvpx --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxml2 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-libspeex --enable-libsoxr --enable-libzmq --enable-libzimg --disable-libjack --disable-indev=jack --enable-videotoolbox --enable-audiotoolbox --enable-neon
libavutil 60. 8.100 / 60. 8.100
libavcodec 62. 11.100 / 62. 11.100
libavformat 62. 3.100 / 62. 3.100
libavdevice 62. 1.100 / 62. 1.100
libavfilter 11. 4.100 / 11. 4.100
libswscale 9. 1.100 / 9. 1.100
libswresample 6. 1.100 / 6. 1.100
[png @ 0x11f60ff50] inflate returned error -3
Input #0, image2, from 'apps/workers/.runtime/assets_gate_p0r2/temp_seq_p0r2_threads2/frame*%04d.png':
Duration: 00:00:01.50, start: 0.000000, bitrate: N/A
Stream #0:0: Video: png, rgb24(pc, gbr/unknown/unknown), 1x1, 2 fps, 2 tbr, 2 tbn
Stream mapping:
Stream #0:0 -> #0:0 (png (native) -> h264 (libx264))
Press [q] to stop, [?] for help
[png @ 0x11f614490] inflate returned error -3
[png @ 0x11f614a30] inflate returned error -3
[png @ 0x11f614fd0] inflate returned error -3
[vist#0:0/png @ 0x11f6114a0] [dec:png @ 0x11f612910] Decoding error: Generic error in an external library
Last message repeated 2 times
[vist#0:0/png @ 0x11f6114a0] [dec:png @ 0x11f612910] Decode error rate 1 exceeds maximum 0.666667
[vist#0:0/png @ 0x11f6114a0] [dec:png @ 0x11f612910] Task finished with error code: -1145393733 (Error number -1145393733 occurred)
[vist#0:0/png @ 0x11f6114a0] [dec:png @ 0x11f612910] Terminating thread with return code -1145393733 (Error number -1145393733 occurred)
[vf#0:0 @ 0x11f6130d0] No filtered frames for output stream, trying to initialize anyway.
[libx264 @ 0x11f611ca0] using cpu capabilities: ARMv8 NEON DotProd I8MM
[libx264 @ 0x11f611ca0] profile High, level 1.0, 4:2:0, 8-bit
[libx264 @ 0x11f611ca0] 264 - core 165 r3222 b35605a - H.264/MPEG-4 AVC codec - Copyleft 2003-2025 - http://www.videolan.org/x264.html - options: cabac=1 ref=3 deblock=1:0:0 analyse=0x3:0x113 me=hex subme=7 psy=1 psy_rd=1.00:0.00 mixed_ref=1 me_range=16 chroma_me=1 trellis=1 8x8dct=1 cqm=0 deadzone=21,11 fast_pskip=1 chroma_qp_offset=-2 threads=2 lookahead_threads=1 sliced_threads=0 nr=0 decimate=1 interlaced=0 bluray_compat=0 constrained_intra=0 bframes=3 b_pyramid=2 b_adapt=1 b_bias=0 direct=1 weightb=1 open_gop=0 weightp=2 keyint=250 keyint_min=2 scenecut=40 intra_refresh=0 rc_lookahead=40 rc=crf mbtree=1 crf=23.0 qcomp=0.60 qpmin=0 qpmax=69 qpstep=4 ip_ratio=1.40 aq=1:1.00
Output #0, mp4, to 'apps/workers/.runtime/assets_gate_p0r2/video_merge_p0r2_threads2.mp4':
Metadata:
encoder : Lavf62.3.100
Stream #0:0: Video: h264 (avc1 / 0x31637661), yuv420p(progressive), 64x64, q=2-31, 2 fps, 16384 tbn
Metadata:
encoder : Lavc62.11.100 libx264
Side data:
cpb: bitrate max/min/avg: 0/0/0 buffer size: 0 vbv_delay: N/A
[out#0/mp4 @ 0x11f60ff50] video:0KiB audio:0KiB subtitle:0KiB other streams:0KiB global headers:0KiB muxing overhead: unknown
[out#0/mp4 @ 0x11f60ff50] Output file is empty, nothing was encoded(check -ss / -t / -frames parameters if used)
frame= 0 fps=0.0 q=0.0 Lsize= 0KiB time=N/A bitrate=N/A speed=N/A elapsed=0:00:00.00  
Conversion failed!

    at Object.merge (packages/engines/video_merge/providers/local_ffmpeg.provider.ts:134:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async testThreads (tools/gate/gates/helper_p0r2_test.ts:48:22)
    at async <anonymous> (tools/gate/gates/helper_p0r2_test.ts:63:28)

[3/3] PASS
GATE P0-R2 [VIDEO_MERGE_GUARDRAILS]: PASS

- ✅ Video Merge resource guardrails check passed

## 总结

- Gate 1 (Preflight): ✅ PASSED
- Gate 2 (Capacity Gate): ❌ FAILED
- Gate 3 (Signed URL): ❌ FAILED
- Gate 4 (Video E2E): ❌ FAILED
- Gate 5 (Capacity Report): ❌ FAILED
- Gate 6 (Video Merge Memory): ✅ PASSED
- Gate 7 (Video Merge Guardrails): ✅ PASSED
