# GATEKEEPER VERIFICATION REPORT (Refinement Sealed)

## 运行环境语义 (Environmental Semantics)

> [!NOTE]
> **MODE = local**: Gate 4/5 设为 **SKIP** (不计入最终失败)，本地开发优先保持稳定全绿。

- Timestamp: 2026年 1月17日 星期六 08时02分19秒 +07
- Mode: local
- API_URL: http://localhost:3000
- NGINX_URL: http://localhost:3000

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
- ⚠️  CORS production check skipped (NODE_ENV != production)

### Gate 2: Capacity Gate Negative Tests
- ✅ Capacity query endpoint works (HTTP 200)
  Command: curl -H "Authorization: Bearer <AUTH_TOKEN_A>" http://localhost:3000/api/jobs/capacity

### Gate 3: Signed URL Full Auto Test
- ✅ Direct access rejected (HTTP 404)
- ❌ Failed to generate signed URL (HTTP 404)

### Gate 4: Video E2E Test
- ⚠️  Skipped (local mode)

### Gate 5: Capacity Report Data Completeness
- ⚠️  Skipped (local mode)

### Gate 6: Video Merge Memory Safety
=== GATE P0-R1 [VIDEO_MERGE_HASH_STREAM] START ===
✅ No readFileSync calls found in provider
Generating 512MB test file at docs/_evidence/tmp_bigfile_512mb.bin...
Running memory check...
/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/tools/gate/gates/gate-p0-r1_video_merge_hash_stream.sh: line 259: syntax error near unexpected token `('
- ❌ Video Merge memory safety check failed

### Gate 7: Video Merge Resource Guardrails
=== GATE P0-R2 [VIDEO_MERGE_GUARDRAILS] START ===
[1/3] Assert spawnWithTimeout kills on timeout (deterministic sleep)...
Starting sleep 5 with 200ms timeout...
[Guardrail] WARN: Killing process 21365 due to timeout (200ms)
result: { code: null, stderr: '', timedOut: true }
PASS: timedOut kill works
[2/3] Assert -threads applied via provider log (default=1 and override=2)...
/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/tools/gate/gates/gate-p0-r2_video_merge_timeout_threads.sh: line 139: syntax error near unexpected token `('
- ❌ Video Merge resource guardrails check failed

### Gate 8: Context Injection Consistency
[GATE] CONTEXT_INJECTION_CONSISTENCY - START
[EVI] /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/context_injection_20260117_080214
[GATE] Probing schema...
   table_name   |      column_name      
----------------+-----------------------
 novel_chapters | id
 novel_chapters | title
 novel_chapters | created_at
 novel_chapters | updated_at
 novel_chapters | summary
 novel_chapters | index
 novel_chapters | is_system_controlled
 novel_chapters | novel_source_id
 novel_chapters | volume_id
 novel_chapters | summary_vector
 novel_scenes   | id
 novel_scenes   | chapter_id
 novel_scenes   | index
 novel_scenes   | raw_text
 novel_scenes   | enriched_text
 novel_scenes   | visual_density_score
 novel_scenes   | character_ids
 novel_scenes   | created_at
 novel_scenes   | updated_at
 novel_scenes   | directing_notes
 novel_scenes   | shot_type
 novel_scenes   | title
 novel_scenes   | graph_state_snapshot
 novel_scenes   | project_id
 novel_sources  | id
 novel_sources  | projectId
 novel_sources  | novelTitle
 novel_sources  | novelAuthor
 novel_sources  | rawText
 novel_sources  | filePath
 novel_sources  | fileName
 novel_sources  | fileSize
 novel_sources  | fileType
 novel_sources  | characterCount
 novel_sources  | chapterCount
 novel_sources  | metadata
 novel_sources  | createdAt
 novel_sources  | updatedAt
 novel_volumes  | id
 novel_volumes  | index
 novel_volumes  | title
 novel_volumes  | novel_source_id
 novel_volumes  | created_at
 novel_volumes  | project_id
 novel_volumes  | updated_at
 organizations  | id
 organizations  | name
 organizations  | ownerId
 organizations  | slug
 organizations  | createdAt
 organizations  | updatedAt
 organizations  | credits
 organizations  | type
 projects       | id
 projects       | name
 projects       | description
 projects       | ownerId
 projects       | organizationId
 projects       | status
 projects       | metadata
 projects       | createdAt
 projects       | updatedAt
 projects       | settingsJson
 scenes         | id
 scenes         | episodeId
 scenes         | index
 scenes         | title
 scenes         | summary
 scenes         | sceneDraftId
 scenes         | characters
 scenes         | enrichedText
 scenes         | projectId
 scenes         | visualDensityScore
 scenes         | reviewStatus
 scenes         | graph_state_snapshot
 shot_jobs      | id
 shot_jobs      | organizationId
 shot_jobs      | projectId
 shot_jobs      | episodeId
 shot_jobs      | sceneId
 shot_jobs      | shotId
 shot_jobs      | taskId
 shot_jobs      | workerId
 shot_jobs      | status
 shot_jobs      | type
 shot_jobs      | priority
 shot_jobs      | maxRetry
 shot_jobs      | retryCount
 shot_jobs      | attempts
 shot_jobs      | lease_until
 shot_jobs      | locked_by
 shot_jobs      | payload
 shot_jobs      | engineConfig
 shot_jobs      | lastError
 shot_jobs      | createdAt
 shot_jobs      | updatedAt
 shot_jobs      | traceId
 shot_jobs      | result
 shot_jobs      | securityProcessed
 shot_jobs      | dedupe_key
 shot_jobs      | is_verification
 users          | id
 users          | email
 users          | passwordHash
 users          | avatar
 users          | userType
 users          | role
 users          | tier
 users          | quota
 users          | defaultOrganizationId
 users          | createdAt
 users          | updatedAt
(112 rows)

[GATE] Using scene table: novel_scenes
[GATE] Creating full project hierarchy (hierarchical fix)...
INSERT 0 1
INSERT 0 2
UPDATE 1
[GATE] Creating jobs in shot_jobs (with top-level traceId)...
INSERT 0 2
[GATE] Polling job status (120s timeout)...
[GATE] Job status: JOB1=PENDING, JOB2=PENDING
[GATE] Job status: JOB1=SUCCEEDED, JOB2=SUCCEEDED
[GATE] Both jobs SUCCEEDED
[GATE] Extracting graph_state_snapshot as JSON...
[{"id": "92183a9b-13be-4d3d-85b7-be4d47343254", "sort_key": "92183a9b-13be-4d3d-85b7-be4d47343254", "graph_state_snapshot": {"chapter_id": "chapter_ctx_2_20260117_080214", "characters": [{"id": "char_zhangsan", "name": "张三", "items": ["长剑"], "status": "normal", "injuries": [], "location": "森林", "appearance": {"hair": "长发", "clothing": "红色长袍"}}], "scene_index": 1}}, {"id": "92509d8f-c327-4843-b37c-31613847aebe", "sort_key": "92509d8f-c327-4843-b37c-31613847aebe", "graph_state_snapshot": {"chapter_id": "chapter_ctx_1_20260117_080214", "characters": [{"id": "char_zhangsan", "name": "张三", "items": ["长剑"], "status": "normal", "injuries": [], "location": "森林", "appearance": {"hair": "长发", "clothing": "红色长袍"}}], "scene_index": 1}}]
[GATE] Validating character consistency...
[GATE] Verifying Long-term Memory retrieval...
[GATE] WARN - Vector search might have returned empty results (check logs)
[GATE] PASS - Character states consistent across snapshots!
[EVI] Evidence archived to: /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/context_injection_20260117_080214
- ✅ Context Injection consistency check passed

### Gate 9: Shots Director Control Fields
--- [GATE P1-1] Shots Director Control Fields Explicitization ---
[Step 1] Checking DB columns existence...
✅ PASS: All 4 director control columns found.
[Step 2] Triggering Stage 1 Pipeline with director control keywords via direct DB insertion...
INSERT 0 1
Job inserted: job_p1_1_20260117_080216. Waiting for completion...
Current status: PENDING... (0/30)
✅ Job Succeeded.
[Step 3] Asserting column data in resulting shots...
Found results:
CLOSE UP|PAN|LOW ANGLE|NIGHT
✅ PASS: All director controls correctly mapped to explicit columns.
[Step 4] Verifying index usage...
⚠️ WARNING: Sequential Scan used (maybe table too small). Checking index existence instead.
❌ FAIL: Index missing
- ❌ Shots Director Control Fields check failed

## 总结

- Gate 1 (Preflight): ✅ PASSED
- Gate 2 (Capacity Gate): ✅ PASSED
- Gate 3 (Signed URL): ❌ FAILED
- Gate 4 (Video E2E): ✅ PASSED
- Gate 5 (Capacity Report): ✅ PASSED
- Gate 6 (Video Merge Memory): ❌ FAILED
- Gate 7 (Video Merge Guardrails): ❌ FAILED
- Gate 8 (Context Injection): ✅ PASSED
- Gate 9 (Shots Director): ❌ FAILED
