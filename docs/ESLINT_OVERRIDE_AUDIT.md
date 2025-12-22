# ESLint Override & Technical Debt Audit

**Generated At:** 2025-12-17T04:13:15.115Z
**Total Files Scanned:** (Dynamic)
**Total Issues:** 1004
**High Risk (any):** 970
**Med Risk (disable):** 34

## 🚨 High Risk Items (Explicit 'any')

| File | Line | Content | Strategy |
|------|------|---------|----------|
| `tools/verify-video-gen.ts` | 43 | `} catch (error: any) {` | Refactor to strict type |
| `tools/verify-stage4-flow.ts` | 38 | `async function fetchJson<T>(url: string, options: any): Promise<ApiResponse<T>> {` | Refactor to strict type |
| `tools/verify-stage4-flow.ts` | 49 | `let data: any;` | Refactor to strict type |
| `tools/verify-stage4-flow.ts` | 56 | `return { data: text as any };` | Refactor to strict type |
| `tools/verify-stage4-flow.ts` | 64 | `} catch (e: any) {` | Refactor to strict type |
| `tools/verify-stage4-flow.ts` | 197 | `} catch (error: any) {` | Refactor to strict type |
| `tools/verify-stage4-5-api.ts` | 73 | `const data = planning.data as any;` | Refactor to strict type |
| `tools/headless-worker.ts` | 10 | `const seasons: any[] = [];` | Refactor to strict type |
| `tools/headless-worker.ts` | 11 | `let currentSeason: any = null;` | Refactor to strict type |
| `tools/headless-worker.ts` | 12 | `let currentEpisode: any = null;` | Refactor to strict type |
| `tools/headless-worker.ts` | 13 | `let currentScene: any = null;` | Refactor to strict type |
| `tools/headless-worker.ts` | 152 | `episodes: [] as any[]` | Refactor to strict type |
| `tools/headless-worker.ts` | 158 | `scenes: [] as any[]` | Refactor to strict type |
| `tools/headless-worker.ts` | 171 | `shots: [] as any[]` | Refactor to strict type |
| `tools/headless-worker.ts` | 225 | `let novelSource: any;` | Refactor to strict type |
| `tools/headless-worker.ts` | 245 | `await prisma.$transaction(async (tx: any) => {` | Refactor to strict type |
| `tools/headless-worker.ts` | 305 | `} catch (e: any) {` | Refactor to strict type |
| `tools/check-prisma.ts` | 10 | `if ((prisma as any).semanticEnhancement) {` | Refactor to strict type |
| `tools/verify/run_sql_verify.ts` | 20 | `results: any[];` | Refactor to strict type |
| `tools/verify/run_sql_verify.ts` | 25 | `function serializeBigInt(obj: any): any {` | Refactor to strict type |
| `tools/verify/run_sql_verify.ts` | 36 | `const serialized: any = {};` | Refactor to strict type |
| `tools/verify/run_sql_verify.ts` | 56 | `let allResults: any[] = [];` | Refactor to strict type |
| `tools/verify/run_sql_verify.ts` | 74 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 43 | `function isHmacRequestResult(x: any): x is HmacRequestResult {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 89 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 152 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 188 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 216 | `const r: any = s.result;` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 245 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 297 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/stage1_stage2_smoke.ts` | 337 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/quality-metrics-smoke.test.ts` | 106 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/init_ce_runtime_api_key.ts` | 24 | `const record = await (prisma as any).apiKey.upsert({` | Refactor to strict type |
| `tools/smoke/init_api_key.ts` | 21 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/init_api_key.ts` | 88 | `role: 'Owner' as any,` | Refactor to strict type |
| `tools/smoke/init_api_key.ts` | 93 | `role: 'Owner' as any,` | Refactor to strict type |
| `tools/smoke/init_api_key.ts` | 135 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/diag_db.ts` | 50 | `} catch (err: any) {` | Refactor to strict type |
| `tools/smoke/diag_db.ts` | 67 | `} catch (err: any) {` | Refactor to strict type |
| `tools/smoke/diag_db.ts` | 84 | `} catch (err: any) {` | Refactor to strict type |
| `tools/smoke/diag_db.ts` | 92 | `} catch (e: any) {` | Refactor to strict type |
| `tools/smoke/ce_api_smoke.ts` | 25 | `response?: any;` | Refactor to strict type |
| `tools/smoke/ce_api_smoke.ts` | 58 | `function request(method: string, path: string, body?: any): Promise<any> {` | Refactor to strict type |
| `tools/smoke/ce_api_smoke.ts` | 148 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce_api_smoke.ts` | 201 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce_api_smoke.ts` | 255 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce_api_smoke.ts` | 313 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 21 | `response?: any;` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 24 | `body?: any;` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 57 | `function request(method: string, path: string, body?: any): Promise<any> {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 153 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 212 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 272 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 336 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 350 | `async function testJobReport(jobId: string, jobType: string, result: any) {` | Refactor to strict type |
| `tools/smoke/ce-core-commercialization-smoke.ts` | 381 | `} catch (error: any) {` | Refactor to strict type |
| `tools/dev/hmac-replay-demo.ts` | 113 | `): Promise<{ statusCode: number; headers: any; body: string }> {` | Refactor to strict type |
| `tools/dev/hmac-replay-demo.ts` | 208 | `} catch (error: any) {` | Refactor to strict type |
| `tools/dev/hmac-replay-demo.ts` | 244 | `} catch (error: any) {` | Refactor to strict type |
| `tools/dev/audit_eslint_overrides.ts` | 54 | `if (lineContent.includes(': any') \|\| lineContent.includes('as any') \|\| lineContent.includes('<an` | Refactor to strict type |
| `tools/smoke/helpers/worker_min_flow.ts` | 17 | `result: HmacRequestResult \| { success: boolean; data?: any; error?: string };` | Refactor to strict type |
| `tools/smoke/helpers/worker_min_flow.ts` | 138 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/helpers/response_body.ts` | 2 | `export async function readResponseBody(response: Response): Promise<any> {` | Refactor to strict type |
| `tools/smoke/helpers/hmac_request.ts` | 21 | `body?: any;` | Refactor to strict type |
| `tools/smoke/helpers/hmac_request.ts` | 29 | `response: any;` | Refactor to strict type |
| `tools/smoke/helpers/hmac_request.ts` | 100 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/helpers/health_check.ts` | 11 | `response: any;` | Refactor to strict type |
| `tools/smoke/helpers/health_check.ts` | 33 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/helpers/engine_binding_flow.ts` | 19 | `result: HmacRequestResult \| { success: boolean; data?: any; error?: string };` | Refactor to strict type |
| `tools/smoke/helpers/engine_binding_flow.ts` | 90 | `const novelJob = jobs.find((j: any) => j.type === 'NOVEL_ANALYSIS');` | Refactor to strict type |
| `tools/smoke/helpers/engine_binding_flow.ts` | 176 | `} catch (error: any) {` | Refactor to strict type |
| `tools/smoke/helpers/crud_min_path.ts` | 153 | `let readShotResult: any = null;` | Refactor to strict type |
| `tools/smoke/helpers/crud_min_path.ts` | 182 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 52 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 68 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 79 | `payload: any;` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 86 | `let result: { success: boolean; result?: any; error?: string };` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 112 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 122 | `} catch (reportError: any) {` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 143 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/worker-agent.ts` | 161 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 479 | `const finalSeasons: any[] = [];` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 484 | `let createdSeason: any;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 533 | `let createdEpisode: any;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 570 | `let createdScene: any;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 617 | `} as any,` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 632 | `} as any,` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 633 | `qualityScore: {} as any,` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 643 | `const shotsToDelete = existingScene.shots.filter((s: any) => !newShotIndexes.has(s.index));` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 654 | `const scenesToDelete = existingEpisode.scenes.filter((s: any) => !newSceneIndexes.has(s.index));` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 667 | `const episodesToDelete = existingSeason.episodes.filter((e: any) => !newEpisodeIndexes.has(e.index))` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 783 | `payload?: any;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 786 | `): Promise<any> {` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 792 | `const payload = (job.payload \|\| {}) as any;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 797 | `(job as any).projectId;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 804 | `let novelSource: any \| null = null;` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 881 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/novel-analysis-processor.ts` | 888 | `projectId: (job.payload as any)?.projectId,` | Refactor to strict type |
| `apps/workers/src/main.ts` | 99 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/main.ts` | 120 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/main.ts` | 154 | `payload: any;` | Refactor to strict type |
| `apps/workers/src/main.ts` | 283 | `if (job.type === 'NOVEL_ANALYSIS' \|\| job.type === 'NOVEL_ANALYSIS_HTTP' \|\| (job.type as any) ===` | Refactor to strict type |
| `apps/workers/src/main.ts` | 369 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/main.ts` | 391 | `} catch (reportError: any) {` | Refactor to strict type |
| `apps/workers/src/main.ts` | 416 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/main.ts` | 492 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/engine-hub-client.ts` | 97 | `} catch (e: any) {` | Refactor to strict type |
| `apps/workers/src/engine-adapter-client.ts` | 83 | `let novelSource: any \| null = null;` | Refactor to strict type |
| `apps/workers/src/engine-adapter-client.ts` | 173 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 41 | `function hashData(data: any): string {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 50 | `job: { id: string; payload: any; projectId: string; taskId?: string },` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 57 | `const traceId = (job as any).traceId;` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 112 | `volumes: result.volumes as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 113 | `chapters: result.chapters as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 114 | `scenes: result.scenes as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 118 | `volumes: result.volumes as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 119 | `chapters: result.chapters as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 120 | `scenes: result.scenes as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 146 | `} catch (auditError: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 164 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 179 | `} catch (auditError: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 205 | `job: { id: string; payload: any; projectId: string; taskId?: string },` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 212 | `const traceId = (job as any).traceId;` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 266 | `metadata: result.quality_indicators as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 291 | `} catch (auditError: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 308 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 323 | `} catch (auditError: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 348 | `job: { id: string; payload: any; projectId: string; taskId?: string },` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 355 | `const traceId = (job as any).traceId;` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 413 | `metadata: result.metadata as any,` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 438 | `} catch (auditError: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 455 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 470 | `} catch (auditError: any) {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 497 | `job: { id: string; payload: any; projectId: string; taskId?: string; shotId?: string },` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 500 | `): Promise<any> {` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 503 | `const traceId = (job as any).traceId \|\| `trace-${jobId}`;` | Refactor to strict type |
| `apps/workers/src/ce-core-processor.ts` | 582 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 72 | `body?: any,` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 118 | `const data = (await response.json()) as any;` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 139 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 159 | `}): Promise<{ id: string; workerId: string; status: string; capabilities: any }> {` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 164 | `capabilities: any;` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 196 | `payload: any;` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 203 | `payload: any;` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 218 | `result?: any;` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 220 | `error?: { message: string; code?: string; details?: any };` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 221 | `metrics?: { durationMs?: number; tokensUsed?: number; cost?: number;[key: string]: any };` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 223 | `}): Promise<any> {` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 224 | `const requestBody: any = {` | Refactor to strict type |
| `apps/workers/src/api-client.ts` | 267 | `auditTrail?: any;` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 74 | `body?: any,` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 75 | `): Promise<any> {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 104 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 121 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 136 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 145 | `async function reportJobSucceeded(jobId: string, output: any): Promise<void> {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 152 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 161 | `async function processJob(job: any): Promise<void> {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 184 | `} catch (error: any) {` | Refactor to strict type |
| `apps/workers/minimal-worker/index.ts` | 224 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/test/stage4-flow.e2e-spec.ts` | 16 | `let org: any;` | Refactor to strict type |
| `apps/api/test/hmac-security.e2e-spec.ts` | 102 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/test/hmac-security.e2e-spec.ts` | 133 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/test/hmac-security.e2e-spec.ts` | 194 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/test/hmac-security.e2e-spec.ts` | 236 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 14 | `logs: any[] = [];` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 15 | `log(message: any) {` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 19 | `warn(message: any) {` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 23 | `error(message: any) {` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 246 | `(adapter as any).logger = mockLogger;` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 258 | `const headersBearer = (adapter as any).buildAuthHeaders(configBearer, { test: 'data' });` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 278 | `const headersApiKey = (adapter as any).buildAuthHeaders(configApiKey, { test: 'data' });` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 296 | `const headersNone = (adapter as any).buildAuthHeaders(configNone, { test: 'data' });` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 347 | `const result = (adapter as any).handleHttpResponse(` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 380 | `const result = (adapter as any).handleHttpError(error, 'http_test', 'TEST_JOB', 1000);` | Refactor to strict type |
| `apps/api/scripts/verify-s3a1.ts` | 481 | `(serviceEmpty as any).validateHttpEngineConfig('', 30000, '/invoke', 'none', undefined, undefined);` | Refactor to strict type |
| `apps/api/scripts/load-test.ts` | 65 | `async function runLoadTest(config: LoadTestConfig): Promise<any> {` | Refactor to strict type |
| `apps/api/scripts/load-test.ts` | 152 | `const report: any = {` | Refactor to strict type |
| `apps/api/scripts/load-test.ts` | 198 | `(test: any) => `### ${test.name}` | Refactor to strict type |
| `apps/api_tests_backup/e2e/validation.e2e.ts` | 15 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/validation.e2e.ts` | 66 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/validation.e2e-spec.ts` | 15 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/validation.e2e-spec.ts` | 67 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/shots-list.e2e-spec.ts` | 18 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/shots-list.e2e-spec.ts` | 117 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/shots-list.e2e-spec.ts` | 169 | `const allFromProject = shots.every((shot: any) => shot.projectId === projectId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/shots-list.e2e-spec.ts` | 192 | `const allReady = shots.every((shot: any) => shot.status === 'READY');` | Refactor to strict type |
| `apps/api_tests_backup/e2e/shots-batch.e2e-spec.ts` | 19 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/shots-batch.e2e-spec.ts` | 126 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/project-tree.e2e-spec.ts` | 20 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/project-tree.e2e-spec.ts` | 127 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/project-list.e2e-spec.ts` | 17 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/project-list.e2e-spec.ts` | 89 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/project-list.e2e-spec.ts` | 141 | `const hasProject1 = projects.some((p: any) => p.id === projectId1);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/project-list.e2e-spec.ts` | 142 | `const hasProject2 = projects.some((p: any) => p.id === projectId2);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/prisma-error.e2e.ts` | 16 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/prisma-error.e2e.ts` | 77 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/prisma-error.e2e-spec.ts` | 16 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/prisma-error.e2e-spec.ts` | 78 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/permissions-jobs.e2e-spec.ts` | 52 | `const decoded = jwt.decode(ownerToken) as any;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts` | 47 | `const decoded = jwt.decode(userToken) as any;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts` | 80 | `const org1Project = projects.find((p: any) => p.id === org1ProjectId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts` | 103 | `const decoded = jwt.decode(newToken) as any;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts` | 120 | `const org1Project = projects.find((p: any) => p.id === org1ProjectId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts` | 142 | `const org2Project = projects.find((p: any) => p.id === org2ProjectId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts` | 166 | `const org1Project = projects.find((p: any) => p.id === org1ProjectId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-isolation.e2e-spec.ts` | 112 | `const userAProject = projects.find((p: any) => p.id === userAProjectId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-isolation.e2e-spec.ts` | 142 | `const userAShot = shots.find((s: any) => s.id === userAShotId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/organization-isolation.e2e-spec.ts` | 154 | `const userAJob = jobs.find((j: any) => j.id === userAJobId);` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-worker.e2e-spec.ts` | 18 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-worker.e2e-spec.ts` | 110 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-worker.e2e-spec.ts` | 145 | `let job: any = null;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-worker.e2e-spec.ts` | 164 | `let job: any = null;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-worker.e2e-spec.ts` | 205 | `let job: any = null;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-dashboard.e2e-spec.ts` | 19 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-dashboard.e2e-spec.ts` | 127 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-dashboard.e2e-spec.ts` | 179 | `const allPending = jobs.every((job: any) => job.status === 'PENDING');` | Refactor to strict type |
| `apps/api_tests_backup/e2e/job-dashboard.e2e-spec.ts` | 196 | `const allImage = jobs.every((job: any) => job.type === 'IMAGE');` | Refactor to strict type |
| `apps/api_tests_backup/e2e/engine-adapter.e2e-spec.ts` | 19 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/engine-adapter.e2e-spec.ts` | 114 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/engine-adapter.e2e-spec.ts` | 167 | `let job: any = null;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/engine-adapter.e2e-spec.ts` | 186 | `let job: any = null;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/engine-adapter.e2e-spec.ts` | 205 | `let job: any = null;` | Refactor to strict type |
| `apps/api_tests_backup/e2e/business-flow.e2e.ts` | 20 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/business-flow.e2e.ts` | 80 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/business-flow.e2e-spec.ts` | 20 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/business-flow.e2e-spec.ts` | 81 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/auth-flow.e2e.ts` | 18 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/auth-flow.e2e.ts` | 91 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/auth-flow.e2e-spec.ts` | 18 | `const report: any = {` | Refactor to strict type |
| `apps/api_tests_backup/e2e/auth-flow.e2e-spec.ts` | 92 | `function recordTest(name: string, passed: boolean, details: any) {` | Refactor to strict type |
| `packages/shared-types/src/engines/engine-adapter.ts` | 40 | `[key: string]: any;` | Refactor to strict type |
| `packages/shared-types/src/engines/engine-adapter.ts` | 73 | `details?: any;` | Refactor to strict type |
| `packages/shared-types/src/engines/engine-adapter.ts` | 83 | `[key: string]: any;` | Refactor to strict type |
| `apps/web/src/lib/handleApiError.ts` | 2 | `export function extractApiErrorMessage(error: any, defaultMessage?: string): string {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 31 | `capabilities: any,` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 51 | `capabilities: capabilities as any,` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 64 | `capabilities: capabilities as any,` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 148 | `const updateData: any = {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 209 | `const enabledWorkers = workers.filter((worker: any) => {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 210 | `const caps = worker.capabilities as any;` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 216 | `return enabledWorkers.filter((worker: any) => {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 217 | `const caps = worker.capabilities as any;` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 254 | `async getNextDispatchedJob(workerId: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 298 | `async startJob(jobId: string, workerId: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 443 | `private async determineWorkerState(worker: any): Promise<'idle' \| 'busy' \| 'dead'> {` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 478 | `const workerIds = workers.map((w: any) => w.id);` | Refactor to strict type |
| `apps/api/src/worker/worker.service.ts` | 501 | `workers.map(async (w: any) => {` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 30 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 32 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 73 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 75 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 125 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 139 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 140 | `const nonce = (request as any).hmacNonce as string \| undefined;` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 141 | `const signature = (request as any).hmacSignature as string \| undefined;` | Refactor to strict type |
| `apps/api/src/worker/worker.controller.ts` | 142 | `const hmacTimestamp = (request as any).hmacTimestamp as string \| undefined;` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 35 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 37 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 77 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 79 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 110 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 124 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 125 | `const nonce = (request as any).hmacNonce as string \| undefined;` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 126 | `const signature = (request as any).hmacSignature as string \| undefined;` | Refactor to strict type |
| `apps/api/src/worker/worker-alias.controller.ts` | 127 | `const hmacTimestamp = (request as any).hmacTimestamp as string \| undefined;` | Refactor to strict type |
| `apps/api/src/text/text.controller.ts` | 39 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/text/text.controller.ts` | 40 | `@CurrentOrganization() org: any,` | Refactor to strict type |
| `apps/api/src/text/text.controller.ts` | 66 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/text/text.controller.ts` | 67 | `@CurrentOrganization() org: any,` | Refactor to strict type |
| `apps/api/src/task/task.service.ts` | 83 | `payload?: any,` | Refactor to strict type |
| `apps/api/src/task/task.service.ts` | 85 | `output?: any,` | Refactor to strict type |
| `apps/api/src/task/task-graph.service.ts` | 61 | `const jobs: TaskGraphJobNode[] = task.jobs.map((job: any) => {` | Refactor to strict type |
| `apps/api/src/task/task-graph.controller.ts` | 64 | `private async enrichJobsWithEngineInfo(jobs: any[], qualityScores: any[]): Promise<any[]> {` | Refactor to strict type |
| `apps/api/src/task/task-graph.controller.ts` | 76 | `const jobMap = new Map(rawJobs.map((job: any) => [job.id, job]));` | Refactor to strict type |
| `apps/api/src/task/task-graph.controller.ts` | 144 | `private async buildQualityScores(taskId: string, jobs: any[]): Promise<any[]> {` | Refactor to strict type |
| `apps/api/src/task/task-graph.controller.ts` | 158 | `const qualityScores: any[] = [];` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 62 | `const jobs: EngineJobSummary[] = task.jobs.map((job: any) => this.mapJobToSummary(job));` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 89 | `const where: any = {` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 126 | `const jobs: EngineJobSummary[] = task.jobs.map((job: any) => this.mapJobToSummary(job));` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 152 | `private extractEngineKey(task: any, job: any): string {` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 155 | `const jobPayload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 163 | `const taskPayload = task.payload as any;` | Refactor to strict type |
| `apps/api/src/task/engine-task.service.ts` | 227 | `private mapJobToSummary(job: any): EngineJobSummary {` | Refactor to strict type |
| `apps/api/src/user/user.service.ts` | 8 | `async findByEmail(email: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/user/user.service.ts` | 14 | `async findById(id: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/user/user.service.ts` | 37 | `async getQuota(userId: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/user/user.controller.ts` | 22 | `async getCurrentUser(@CurrentUser() user: { userId: string }): Promise<any> {` | Refactor to strict type |
| `apps/api/src/user/user.controller.ts` | 47 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/user/user.controller.ts` | 77 | `async getQuota(@CurrentUser() user: { userId: string }): Promise<any> {` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 99 | `} catch (e: any) {` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 106 | `const prisma = this.prisma as any;` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 116 | `const prisma = this.prisma as any;` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 154 | `const prisma = this.prisma as any;` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 162 | `const prisma = this.prisma as any;` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 196 | `const prisma: any = this.prisma;` | Refactor to strict type |
| `apps/api/src/stage4/stage4.service.ts` | 202 | `async recordAudit(action: string, resourceType: string, resourceId: string \| null, userId: string, ` | Refactor to strict type |
| `apps/api/src/story/story.controller.ts` | 38 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/story/story.controller.ts` | 39 | `@CurrentOrganization() org: any,` | Refactor to strict type |
| `apps/api/src/shot-director/shot-director.controller.ts` | 33 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/shot-director/shot-director.controller.ts` | 48 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/scripts/sync-engines-from-json.ts` | 11 | `const data = JSON.parse(content) as { engines: any[] };` | Refactor to strict type |
| `apps/api/src/scripts/sync-engines-from-json.ts` | 14 | `const exists = await (prisma as any).engine.findUnique({ where: { engineKey: engine.engineKey } });` | Refactor to strict type |
| `apps/api/src/scripts/sync-engines-from-json.ts` | 20 | `await (prisma as any).engine.create({` | Refactor to strict type |
| `apps/api/src/scripts/reset-test-jobs.ts` | 10 | `where: { type: 'NOVEL_ANALYSIS' as any },` | Refactor to strict type |
| `apps/api/src/scripts/reset-test-jobs.ts` | 12 | `status: 'PENDING' as any,` | Refactor to strict type |
| `apps/api/src/scripts/init-worker-api-key.ts` | 42 | `const apiKey = await (prisma as any).apiKey.create({` | Refactor to strict type |
| `apps/api/src/scripts/init-worker-api-key.ts` | 59 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/scripts/e2e-novel-worker-pipeline.ts` | 151 | `app: any,` | Refactor to strict type |
| `apps/api/src/scripts/e2e-novel-worker-pipeline.ts` | 300 | `async function triggerOrchestrator(app: any): Promise<void> {` | Refactor to strict type |
| `apps/api/src/scripts/e2e-novel-worker-pipeline.ts` | 495 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/scripts/debug-jobs.ts` | 10 | `type: 'NOVEL_ANALYSIS' as any,` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 52 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 65 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 88 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 109 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 126 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 143 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 152 | `async setJson(key: string, value: any, ttlSeconds?: number): Promise<boolean> {` | Refactor to strict type |
| `apps/api/src/redis/redis.service.ts` | 156 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 29 | `job: any,` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 70 | `private extractEngineKey(job: any): string {` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 72 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 94 | `private extractMetrics(job: any): QualityScoreRecord['metrics'] {` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 98 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 100 | `const result = payload.result as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 102 | `const resultMetrics = result.metrics as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 123 | `private extractQuality(job: any): QualityScoreRecord['quality'] {` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 127 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 129 | `const result = payload.result as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 133 | `const resultQuality = result.quality as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 158 | `private extractModelInfo(job: any, adapter: EngineAdapter \| null): QualityScoreRecord['modelInfo'] ` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 163 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 165 | `const result = payload.result as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-score.service.ts` | 167 | `const resultModelInfo = result.modelInfo as any;` | Refactor to strict type |
| `apps/api/src/quality/quality-metrics.writer.ts` | 31 | `result?: any;` | Refactor to strict type |
| `apps/api/src/quality/quality-metrics.writer.ts` | 47 | `let metadata: any = {};` | Refactor to strict type |
| `apps/api/src/quality/quality-metrics.writer.ts` | 103 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/project/structure-generate.service.ts` | 24 | `async generateStructure(projectId: string, organizationId: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/structure-generate.service.ts` | 70 | `existingEpisodes.some((e: any) => e.scenes && e.scenes.length > 0);` | Refactor to strict type |
| `apps/api/src/project/structure-generate.service.ts` | 176 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 71 | `const projectData = project as any;` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 75 | `const succeeded = tasks.find((t: any) => t.status === 'SUCCEEDED');` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 76 | `const failed = tasks.find((t: any) => t.status === 'FAILED');` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 88 | `(t: any) => t.status === 'PENDING' \|\| t.status === 'RUNNING' \|\| t.status === 'RETRYING',` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 103 | `seasons: projectData.seasons.map((season: any) => this.mapSeasonToNode(season)),` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 104 | `episodes: (project as any).episodes?.length > 0` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 105 | `? (project as any).episodes.map((episode: any) => this.mapEpisodeToNode(episode, project.id))` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 126 | `private mapSeasonToNode(season: any): SeasonNode {` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 133 | `episodes: season.episodes.map((episode: any) => this.mapEpisodeToNode(episode, season.projectId)),` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 141 | `private mapEpisodeToNode(episode: any, parentId: string): EpisodeNode {` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 148 | `scenes: episode.scenes.map((scene: any) => this.mapSceneToNode(scene)),` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 156 | `private mapSceneToNode(scene: any): SceneNode {` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 163 | `shots: scene.shots.map((shot: any) => this.mapShotToNode(shot)),` | Refactor to strict type |
| `apps/api/src/project/scene-graph.service.ts` | 171 | `private mapShotToNode(shot: any): ShotNode {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 116 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 332 | `const succeeded = tasks.find((t: any) => t.status === TaskStatus.SUCCEEDED);` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 333 | `const failed = tasks.find((t: any) => t.status === TaskStatus.FAILED);` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 346 | `(t: any) =>` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 358 | `const enrichShot = (parentScene: any) => (shot: any) => {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 371 | `const generatedAssets = shot.assets?.filter((a: any) => a.status === 'GENERATED' \|\| a.status === '` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 399 | `const enrichScene = (scene: any) => {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 423 | `const seasons = project.seasons.map((season: any) => ({` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 425 | `episodes: season.episodes.map((episode: any) => ({` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 433 | `const legacyEpisodes = project.episodes?.map((episode: any) => ({` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 550 | `async createSeason(projectId: string, createSeasonDto: { index: number; title: string; description?:` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 718 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 867 | `title: (createShotDto as any).title,` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 868 | `description: (createShotDto as any).description,` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1002 | `const updateData: any = { ...updateShotDto };` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1006 | `updateData.status = updateData.status as any;` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1054 | `const where: any = {};` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1144 | `const filteredShots = shots.filter((shot: any) => {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1150 | `const formattedShots = filteredShots.map((shot: any) => ({` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1229 | `const flowImport: any = {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1249 | `const flowStructure: any = {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1267 | `const flowScript: any = { key: 'SCRIPT_SEMANTIC', label: 'Script Semantic', status: 'PENDING', gate:` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1268 | `const flowShot: any = { key: 'SHOT_PLANNING', label: 'Shot Planning', status: 'PENDING', gate: { can` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1269 | `const flowAsset: any = { key: 'ASSET_GENERATION', label: 'Asset Gen', status: 'PENDING', gate: { can` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1270 | `const flowVideo: any = { key: 'VIDEO_GENERATION', label: 'Video Gen', status: 'PENDING', gate: { can` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1271 | `const flowExport: any = { key: 'COMPOSE_EXPORT', label: 'Export', status: 'PENDING', gate: { canRun:` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1275 | `let nextAction: any = {` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1329 | `const recentAudit = auditLogs.map((log: any) => ({` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1364 | `running: jobs.map((j: any) => ({` | Refactor to strict type |
| `apps/api/src/project/project.service.ts` | 1376 | `structure: structureQuality as any,` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 64 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 87 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 125 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 143 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 164 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 186 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 205 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 224 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 244 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 261 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 291 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 323 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 355 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 387 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 417 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 440 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 473 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 491 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 508 | `} as any, organizationId)` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 523 | `@Body() body: { shotIds: string[]; jobType: 'IMAGE' \| 'VIDEO' \| 'STORYBOARD' \| 'AUDIO'; engine?: ` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 527 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/project/project.controller.ts` | 571 | `type: JobTypeEnum.SHOT_RENDER as any,` | Refactor to strict type |
| `apps/api/src/project/project-structure.service.ts` | 103 | `const seasonNodes: ProjectStructureSeasonNode[] = seasons.map((season: any) => {` | Refactor to strict type |
| `apps/api/src/project/project-structure.service.ts` | 104 | `const episodeNodes: ProjectStructureEpisodeNode[] = season.episodes.map((episode: any) => {` | Refactor to strict type |
| `apps/api/src/project/project-structure.service.ts` | 105 | `const sceneNodes: ProjectStructureSceneNode[] = episode.scenes.map((scene: any) => {` | Refactor to strict type |
| `apps/api/src/project/project-structure.service.ts` | 106 | `const shotNodes: ProjectStructureShotNode[] = scene.shots.map((shot: any) => ({` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 13 | `function coerceGateStatus(v: any): GateStatus \| undefined {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 38 | `const jobs = await (this.prisma as any).job.findMany({` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 50 | `} as any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 55 | `for (const j of jobs as any[]) {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 62 | `const anyProject: any = project \|\| {};` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 78 | `const seasons = (structure as any).seasons;` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 83 | `root.children = seasons.map((s: any) => {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 94 | `seasonNode.children = episodes.map((e: any) => {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 105 | `episodeNode.children = scenes.map((sc: any) => {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 128 | `sceneNode.children = shots.map((sh: any) => {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 173 | `let where: any = { projectId };` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 177 | `const job = await (this.prisma as any).job.findFirst({` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 180 | `select: { id: true, status: true } as any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 222 | `private async writeAudit(projectId: string, actorId: string, action: string, payload: any) {` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.service.ts` | 226 | `await (this.prisma as any).auditLog.create({` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.controller.ts` | 17 | `@Req() req: any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.controller.ts` | 18 | `@Body() body: any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.controller.ts` | 30 | `@Req() req: any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.controller.ts` | 31 | `@Body() body: any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.controller.ts` | 43 | `@Req() req: any,` | Refactor to strict type |
| `apps/api/src/pipeline/pipeline.controller.ts` | 44 | `@Body() body: any,` | Refactor to strict type |
| `apps/api/src/permission/permission.service.ts` | 36 | `(this.prisma as any).rolePermission.findMany({` | Refactor to strict type |
| `apps/api/src/permission/permission.service.ts` | 44 | `(this.prisma as any).rolePermission.findMany({` | Refactor to strict type |
| `apps/api/src/permission/permission.service.ts` | 55 | `const perms = Array.from(new Set(rolePerms.map((rp: any) => rp.permission.key))) as string[];` | Refactor to strict type |
| `apps/api/src/permission/permission.service.ts` | 66 | `const member = await (this.prisma as any).projectMember.findUnique({` | Refactor to strict type |
| `apps/api/src/permission/permission.service.ts` | 79 | `.filter((rp: any) => rp.permission.scope === 'project')` | Refactor to strict type |
| `apps/api/src/permission/permission.service.ts` | 80 | `.map((rp: any) => rp.permission.key),` | Refactor to strict type |
| `apps/api/src/organization/organization.service.ts` | 12 | `async getUserOrganizations(userId: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/organization/organization.service.ts` | 21 | `return memberships.map((m: any) => ({` | Refactor to strict type |
| `apps/api/src/organization/organization.service.ts` | 33 | `async createOrganization(userId: string, name: string, slug?: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/organization/organization.service.ts` | 65 | `async getOrganizationById(organizationId: string, userId: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/organization/organization.controller.ts` | 23 | `async getUserOrganizations(@CurrentUser() user: { userId: string }): Promise<any> {` | Refactor to strict type |
| `apps/api/src/organization/organization.controller.ts` | 37 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/organization/organization.controller.ts` | 55 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/organization/organization.controller.ts` | 72 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/orchestrator/orchestrator.service.ts` | 135 | `const offlineWorkerIds = offlineWorkers.map((w: any) => w.id);` | Refactor to strict type |
| `apps/api/src/orchestrator/orchestrator.service.ts` | 215 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/orchestrator/orchestrator.service.ts` | 420 | `const waitTimes = pendingJobsWithTime.map((job: any) => now.getTime() - job.createdAt.getTime());` | Refactor to strict type |
| `apps/api/src/orchestrator/orchestrator.controller.ts` | 15 | `async dispatch(): Promise<any> {` | Refactor to strict type |
| `apps/api/src/orchestrator/orchestrator.controller.ts` | 31 | `async getStats(): Promise<any> {` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.service.ts` | 139 | `} as any,` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 223 | `type: 'NOVEL_ANALYSIS' as any,` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 267 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 285 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 379 | `type: 'NOVEL_ANALYSIS' as any,` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 440 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 460 | `const mappedJobs = jobs.map((job: any) => ({` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 526 | `let job: any = null;` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 565 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 595 | `type: 'NOVEL_ANALYSIS' as any,` | Refactor to strict type |
| `apps/api/src/novel-import/novel-import.controller.ts` | 649 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/memory/memory.service.ts` | 97 | `body: { type: 'short-term' \| 'long-term'; chapterId?: string; entityId?: string; data: any },` | Refactor to strict type |
| `apps/api/src/memory/memory.controller.ts` | 34 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/memory/memory.controller.ts` | 49 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/memory/memory.controller.ts` | 63 | `@Body() body: { type: 'short-term' \| 'long-term'; chapterId?: string; entityId?: string; data: any ` | Refactor to strict type |
| `apps/api/src/memory/memory.controller.ts` | 64 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 176 | `let shotId = (createJobDto.payload as any)?.shotId as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 177 | `let episodeId = (createJobDto.payload as any)?.episodeId as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 178 | `let sceneId = (createJobDto.payload as any)?.sceneId as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 179 | `const projectId = (createJobDto.payload as any)?.projectId as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 180 | `const chapterId = (createJobDto.payload as any)?.chapterId as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 207 | `let episode: any = null;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 353 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 372 | `payload: any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 373 | `}): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 514 | `const caps = worker.capabilities as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 522 | `const whereClause: any = {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 534 | `const whereEngineBinding: any = {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 674 | `result?: any,` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 734 | `const updatedPayload: any =` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 735 | `result ? { ...((job.payload as Record<string, any>) \|\| {}), result } : (job.payload as any);` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 755 | `const modelUsed = (job.engineConfig as any)?.engineKey \|\| (job.payload as any)?.engineKey \|\| nul` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 827 | `const payload = task.payload as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 864 | `const payload = task.payload as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 938 | `result?: any,` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 961 | `const modelUsed = (job.engineConfig as any)?.engineKey \|\| (job.payload as any)?.engineKey \|\| nul` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1039 | `const allSucceeded = task.jobs.every((job: any) => job.status === JobStatusEnum.SUCCEEDED);` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1040 | `const hasFailed = task.jobs.some((job: any) => job.status === JobStatusEnum.FAILED);` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1041 | `const hasRetrying = task.jobs.some((job: any) => job.status === JobStatusEnum.RETRYING);` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1043 | `(job: any) => job.status === JobStatusEnum.PENDING \|\| job.status === JobStatusEnum.RUNNING,` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1048 | `const taskOutput = task.jobs.map((j: any) => ({` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1055 | `const workerId = task.jobs.find((j: any) => j.workerId)?.workerId \|\| null;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1063 | `const workerId = task.jobs.find((j: any) => j.workerId)?.workerId \|\| null;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1214 | `const where: any = {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1297 | `const filteredJobs = jobs.filter((job: any) => {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1316 | `filteredJobs.map(async (job: any) => {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1383 | `extractEngineKeyFromJob(job: any): string {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1385 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1400 | `extractEngineVersionFromJob(job: any): string \| null {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1402 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1409 | `const engineConfig = job.engineConfig as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1438 | `const where: any = {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1485 | `const filteredJobs = jobs.filter((job: any) => {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1521 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1668 | `const succeeded = results.filter((r: any) => r.status === 'fulfilled').length;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1669 | `const failed = results.filter((r: any) => r.status === 'rejected').length;` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1814 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1832 | `async markJobSucceeded(jobId: string, resultPayload?: any) {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1862 | `async markJobFailed(jobId: string, errorMessage?: string, resultPayload?: any) {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1894 | `private async handleCECoreJobCompletion(job: any, result?: any): Promise<void> {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1903 | `const payload = (task.payload as any) \|\| {};` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1948 | `private async handleShotRenderSecurityPipeline(job: any, result?: any): Promise<void> {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 1981 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 2010 | `private async handleCECoreJobFailure(job: any): Promise<void> {` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 2020 | `const payload = (task.payload as any) \|\| {};` | Refactor to strict type |
| `apps/api/src/job/job.service.ts` | 2038 | `(j: any) => j.type === nextJobType && j.status === JobStatusEnum.PENDING,` | Refactor to strict type |
| `apps/api/src/job/job.retry.ts` | 71 | `payload: any;` | Refactor to strict type |
| `apps/api/src/job/job.retry.ts` | 98 | `payload: payload as any,` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 33 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 48 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 63 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 78 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 98 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 119 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 136 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 154 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 172 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 190 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 208 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 231 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 233 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 236 | `const workerId = (request.body as any)?.workerId \|\| (request.headers['x-worker-id'] as string);` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 277 | `): Promise<any> {` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 279 | `const apiKeyId = (request as any).apiKey?.id;` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 280 | `const nonce = (request as any).hmacNonce as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 281 | `const signature = (request as any).hmacSignature as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job.controller.ts` | 282 | `const hmacTimestamp = (request as any).hmacTimestamp as string \| undefined;` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 19 | `if ((env as any).jobWorkerEnabled) {` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 20 | `this.logger.log(`Job Worker enabled, starting with interval ${(env as any).jobWorkerInterval}ms`);` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 38 | `}, (env as any).jobWorkerInterval);` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 72 | `const jobs = allPendingJobs.filter((job: any) => {` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 75 | `}).slice(0, (env as any).jobWorkerBatchSize);` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 84 | `const processingPromises = jobs.map((job: any) =>` | Refactor to strict type |
| `apps/api/src/job/job-worker.service.ts` | 85 | `this.jobService.processJob(job.id).catch((error: any) => {` | Refactor to strict type |
| `apps/api/src/job/job-report.facade.ts` | 35 | `result?: any;` | Refactor to strict type |
| `apps/api/src/job/job-report.facade.ts` | 46 | `params.status as any,` | Refactor to strict type |
| `apps/api/src/job/job-report.facade.ts` | 81 | `result: params.result \|\| (job.payload as any)?.result,` | Refactor to strict type |
| `apps/api/src/job/job-report.facade.ts` | 94 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/job/job-processor.interface.ts` | 10 | `payload: any;` | Refactor to strict type |
| `apps/api/src/job/job-processor.interface.ts` | 11 | `result?: any;` | Refactor to strict type |
| `apps/api/src/job/job-processor.interface.ts` | 38 | `result?: any;` | Refactor to strict type |
| `apps/api/src/job/job-engine-binding.service.ts` | 83 | `metadata?: any,` | Refactor to strict type |
| `apps/api/src/health/health.controller.ts` | 41 | `checks.redis = (this.redisService as any).isConnected \|\| false;` | Refactor to strict type |
| `apps/api/src/engines/engine-router.service.ts` | 5 | `payload?: any;` | Refactor to strict type |
| `apps/api/src/engine-profile/engine-profile.service.ts` | 32 | `const timeFilter: any = {};` | Refactor to strict type |
| `apps/api/src/engine-profile/engine-profile.service.ts` | 41 | `const where: any = {};` | Refactor to strict type |
| `apps/api/src/engine-profile/engine-profile.service.ts` | 68 | `jobs: any[];` | Refactor to strict type |
| `apps/api/src/engine-profile/engine-profile.service.ts` | 132 | `const payload = job.payload as any;` | Refactor to strict type |
| `apps/api/src/engine-profile/engine-profile.service.spec.ts` | 100 | `jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue(mockJobs as any);` | Refactor to strict type |
| `apps/api/src/engine-profile/engine-profile.service.spec.ts` | 136 | `jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue(mockJobs as any);` | Refactor to strict type |
| `apps/api/src/engine-hub/engine-invoker-hub.service.ts` | 141 | `} catch (e: any) {` | Refactor to strict type |
| `apps/api/src/engine-hub/engine-descriptor.interface.ts` | 28 | `adapterToken?: any;` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 8 | `config: any;` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 14 | `config?: any;` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 23 | `config: any;` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 29 | `config?: any;` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 40 | `const engines = await (this.prisma as any).engine.findMany({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 50 | `return engines.map((engine: any) => ({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 63 | `async createOrReplace(input: UpsertEngineInput): Promise<any> {` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 64 | `return (this.prisma as any).engine.upsert({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 93 | `async update(engineKey: string, input: UpdateEngineInput): Promise<any> {` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 94 | `const existing = await (this.prisma as any).engine.findUnique({ where: { engineKey } });` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 98 | `return (this.prisma as any).engine.update({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 111 | `await (this.prisma as any).engine.delete({ where: { engineKey } });` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 115 | `const engine = await (this.prisma as any).engine.findUnique({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 122 | `async createOrUpdateVersion(engineKey: string, input: UpsertEngineVersionInput): Promise<any> {` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 123 | `const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 127 | `return (this.prisma as any).engineVersion.upsert({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 144 | `async updateVersion(engineKey: string, versionName: string, input: UpdateEngineVersionInput): Promis` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 145 | `const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 148 | `const existing = await (this.prisma as any).engineVersion.findUnique({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 153 | `return (this.prisma as any).engineVersion.update({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 164 | `const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 169 | `await (this.prisma as any).engine.update({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 175 | `await (this.prisma as any).engineVersion.delete({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 180 | `async updateDefaultVersion(engineKey: string, defaultVersion: string \| null): Promise<any> {` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 181 | `const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 185 | `const ver = await (this.prisma as any).engineVersion.findUnique({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.service.ts` | 191 | `return (this.prisma as any).engine.update({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.controller.ts` | 31 | `const publicData = data.map((engine: any) => ({` | Refactor to strict type |
| `apps/api/src/engine-admin/engine-admin.controller.ts` | 36 | `versions: engine.versions?.map((v: any) => ({` | Refactor to strict type |
| `apps/api/src/engine/engine.controller.ts` | 22 | `const publicData = engines.map((engine: any) => ({` | Refactor to strict type |
| `apps/api/src/engine/engine.controller.ts` | 27 | `versions: engine.versions?.map((v: any) => ({` | Refactor to strict type |
| `apps/api/src/engine/engine-strategy.service.ts` | 20 | `[key: string]: any;` | Refactor to strict type |
| `apps/api/src/engine/engine-strategy.service.ts` | 49 | `payload: any,` | Refactor to strict type |
| `apps/api/src/engine/engine-routing.service.ts` | 6 | `payload?: any;` | Refactor to strict type |
| `apps/api/src/engine/engine-registry.service.ts` | 56 | `this.defaultEngineKey = (env as any).engineDefault \|\| 'default_novel_analysis';` | Refactor to strict type |
| `apps/api/src/engine/engine-registry.service.ts` | 62 | `private getJsonConfig(engineKey: string): any \| undefined {` | Refactor to strict type |
| `apps/api/src/engine/engine-registry.service.ts` | 138 | `findAdapter(engineKey?: string, jobType?: string, payload?: any): EngineAdapter {` | Refactor to strict type |
| `apps/api/src/engine/engine-registry.service.ts` | 284 | `const nextPayload: any = {` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 18 | `return (this.prisma as any).engine?.findUnique({ where: { engineKey } }) ?? null;` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 22 | `const engine = await (this.prisma as any).engine?.findUnique({` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 27 | `return engine.versions?.find((v: any) => v.versionName === versionName) ?? null;` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 31 | `const engine = await (this.prisma as any).engine?.findUnique({` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 42 | `if (!(this.prisma as any).engine) return [];` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 43 | `return (this.prisma as any).engine.findMany({ orderBy: { engineKey: 'asc' } });` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 51 | `mergeConfig(dbEngine: any \| null, jsonConfig?: EngineJsonConfig) {` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 52 | `const merged: any = {` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 59 | `isDefaultForJobTypes: (jsonConfig as any)?.isDefaultForJobTypes ?? undefined,` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 65 | `const cfg = dbEngine.config as any;` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 91 | `const result: any = {};` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 96 | `const next = (src as any)[key];` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 107 | `result[key] = this.deepMerge(prev as any, next as any);` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 120 | `async resolveEngineConfig(engineKey: string, requestedVersion?: string): Promise<any> {` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 125 | `let versionConfig: any = null;` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 135 | `const merged = this.deepMerge<any>(` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 136 | `(jsonConfig as any) ?? {},` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 137 | `(engine?.config as any) ?? {},` | Refactor to strict type |
| `apps/api/src/engine/engine-config-store.service.ts` | 138 | `(versionConfig as any) ?? {},` | Refactor to strict type |
| `apps/api/src/ce-engine/ce-engine.controller.ts` | 99 | `const apiKeyId = (req as any).apiKeyId;` | Refactor to strict type |
| `apps/api/src/billing/billing.controller.ts` | 11 | `async subscribe(@Req() req: any, @Body('planId') planId: string) {` | Refactor to strict type |
| `apps/api/src/billing/billing.controller.ts` | 18 | `async getSubscription(@Req() req: any) {` | Refactor to strict type |
| `apps/api/src/auth/nonce.service.ts` | 55 | `await (this.prisma as any).nonceStore.create({` | Refactor to strict type |
| `apps/api/src/auth/nonce.service.ts` | 76 | `const existing = await (this.prisma as any).$queryRaw<Array<{ count: bigint }>>`` | Refactor to strict type |
| `apps/api/src/auth/nonce.service.ts` | 92 | `await (this.prisma as any).$queryRaw`` | Refactor to strict type |
| `apps/api/src/auth/nonce.service.ts` | 106 | `} catch (err: any) {` | Refactor to strict type |
| `apps/api/src/auth/jwt.strategy.ts` | 21 | `(request: any) => {` | Refactor to strict type |
| `apps/api/src/auth/hmac.guard.ts` | 20 | `private getPath(req: any): string {` | Refactor to strict type |
| `apps/api/src/auth/auth.service.ts` | 21 | `const { email, password, userType = 'individual' as any } = registerDto;` | Refactor to strict type |
| `apps/api/src/audit/audit.service.ts` | 15 | `details?: any;` | Refactor to strict type |
| `apps/api/src/audit/audit.service.ts` | 25 | `await (this.prisma as any).auditLog.create({` | Refactor to strict type |
| `apps/api/src/audit/audit.service.ts` | 34 | `details: input.details ? (input.details as any) : {},` | Refactor to strict type |
| `apps/api/src/audit/audit.interceptor.ts` | 20 | `intercept(context: ExecutionContext, next: CallHandler): Observable<any> {` | Refactor to strict type |
| `apps/api/src/audit-log/audit-log.service.ts` | 32 | `details?: any;` | Refactor to strict type |
| `apps/api/src/audit-log/audit-log.service.ts` | 51 | `await (this.prisma as any).auditLog.create({` | Refactor to strict type |
| `apps/api/src/audit-log/audit-log.service.ts` | 81 | `static extractRequestInfo(request: any): { ip?: string; userAgent?: string } {` | Refactor to strict type |
| `apps/api/src/audit-log/audit-log.controller.ts` | 21 | `auditTrail?: any;` | Refactor to strict type |
| `apps/api/src/asset/asset.controller.ts` | 34 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/asset/asset.controller.ts` | 49 | `@CurrentUser() user: any,` | Refactor to strict type |
| `apps/api/src/asset/asset.controller.ts` | 64 | `@CurrentUser() user: any,` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 810 | `$executeRaw<T = unknown>(query: TemplateStringsArray \| Prisma.Sql, ...values: any[]): Prisma.Prisma` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 822 | `$executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 833 | `$queryRaw<T = unknown>(query: TemplateStringsArray \| Prisma.Sql, ...values: any[]): Prisma.PrismaPr` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 845 | `$queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 861 | `$transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1562 | `select: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1563 | `include: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1567 | `select: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1568 | `omit: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1574 | `export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1579 | `export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<Retur` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 1648 | `type IsObject<T extends any> = T extends Array<any>` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5785 | `payload: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5788 | `args: [query: TemplateStringsArray \| Prisma.Sql, ...values: any[]],` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5789 | `result: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5792 | `args: [query: string, ...values: any[]],` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5793 | `result: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5796 | `args: [query: TemplateStringsArray \| Prisma.Sql, ...values: any[]],` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5797 | `result: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5800 | `args: [query: string, ...values: any[]],` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5801 | `result: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 5908 | `args: any` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 7544 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 7550 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 8719 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 8725 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 9878 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 9884 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 10920 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 10926 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 12182 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 12188 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 13220 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 13226 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 14354 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 14360 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 15510 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 15516 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 16663 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 16669 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 17619 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 17625 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 18573 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 18579 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 19578 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 19584 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 20645 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 20651 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 21692 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 21698 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 22744 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 22750 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 23734 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 23740 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 24661 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 24667 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 25629 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 25635 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 26573 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 26579 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 27522 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 27528 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 28618 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 28624 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 29709 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 29715 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 30933 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 30939 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 32083 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 32089 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 33069 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 33075 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 34001 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 34007 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 34892 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 34898 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 35891 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 35897 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 36900 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 36906 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 38033 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 38039 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 39082 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 39088 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 40078 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 40084 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 41098 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 41104 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 42097 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 42103 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 43178 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 43184 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 44282 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 44288 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 45366 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 45372 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 46379 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 46385 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 47503 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 47509 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 48593 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 48599 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 49539 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 49545 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 50472 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 50478 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 51370 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 51376 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 52297 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 52303 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 53225 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 53231 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 54182 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 54188 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 55082 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 55088 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 55980 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 55986 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 56926 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 56932 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 57944 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 57950 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 58877 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 58883 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 59860 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 59866 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 60874 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 60880 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 61800 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 61806 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 62760 | `then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 \| PromiseLike<TResult1>)` | Refactor to strict type |
| `packages/database/src/generated/prisma/index.d.ts` | 62766 | `catch<TResult = never>(onrejected?: ((reason: any) => TResult \| PromiseLike<TResult>) \| undefined ` | Refactor to strict type |
| `apps/web/src/components/_legacy/ShotEditor.tsx` | 28 | `result?: any;` | Refactor to strict type |
| `apps/api/src/security/api-security/secret-encryption.service.ts` | 41 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/security/api-security/secret-encryption.service.ts` | 96 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.service.ts` | 53 | `const keyRecord = await (this.prisma as any).apiKey.findUnique({` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.service.ts` | 209 | `await (this.prisma as any).apiKey.update({` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.service.ts` | 232 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.service.ts` | 341 | `keyRecord: any,` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.service.ts` | 355 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.guard.ts` | 97 | `if ((request as any).rawBody) {` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.guard.ts` | 98 | `rawBodyBytes = Buffer.isBuffer((request as any).rawBody)` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.guard.ts` | 99 | `? (request as any).rawBody` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.guard.ts` | 100 | `: Buffer.from((request as any).rawBody);` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.guard.ts` | 139 | `(request as any).apiKey = result.apiKey;` | Refactor to strict type |
| `apps/api/src/security/api-security/api-security.guard.ts` | 140 | `(request as any).apiKeyId = result.apiKeyId;` | Refactor to strict type |
| `apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` | 154 | `app: any,` | Refactor to strict type |
| `apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` | 356 | `async function triggerOrchestrator(app: any): Promise<void> {` | Refactor to strict type |
| `apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` | 511 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` | 677 | `app: any,` | Refactor to strict type |
| `apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` | 879 | `async function triggerOrchestrator(app: any): Promise<void> {` | Refactor to strict type |
| `apps/api/src/scripts/legacy/e2e-novel-pipeline.legacy.ts` | 1034 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/job/dto/report-job.dto.ts` | 10 | `result?: any;` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 27 | `data?: any;` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 34 | `[key: string]: any;` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 39 | `details?: any;` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 107 | `{ status: response.status, data: response.data, headers: response.headers as any },` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 112 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 124 | `private buildRequestBody(input: EngineInvokeInput): any {` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 148 | `private buildAuthHeaders(config: HttpEngineConfig, requestBody: any): Record<string, string> {` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 192 | `private buildHmacHeaders(hmacConfig: { keyId: string; secret: string; algorithm: 'sha256'; header?: ` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 238 | `payload: any,` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 239 | `context: any,` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 241 | `const logData: any = {` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 431 | `const data = (responseData as any).data ?? {};` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 448 | `private parseMetrics(rawMetrics?: any, durationMs?: number): EngineInvokeResult['metrics'] \| undefi` | Refactor to strict type |
| `apps/api/src/engine/adapters/http-engine.adapter.ts` | 464 | `private handleHttpError(error: any, engineKey: string, jobType: string, durationMs: number): EngineI` | Refactor to strict type |
| `apps/api/src/common/interceptors/logging.interceptor.ts` | 15 | `intercept(context: ExecutionContext, next: CallHandler): Observable<any> {` | Refactor to strict type |
| `apps/api/src/common/interceptors/hmac-signature.interceptor.ts` | 36 | `private getPath(req: any): string {` | Refactor to strict type |
| `apps/api/src/common/interceptors/hmac-signature.interceptor.ts` | 41 | `async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {` | Refactor to strict type |
| `apps/api/src/common/filters/http-exception.filter.ts` | 34 | `message = (exceptionResponse as any).message \|\| message;` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 33 | `const err = exception as any;` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 35 | `const errorCode = (errorBody as any)?.error?.code;` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 52 | `message: (errorBody as any)?.error?.message \|\| err?.message,` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 53 | `userId: (req as any).user?.id \|\| (req as any).user?.userId,` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 54 | `apiKeyId: (req as any).apiKeyId,` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 55 | `nonce: req.headers['x-nonce'] \|\| (req as any).hmac?.nonce,` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 56 | `timestamp: req.headers['x-timestamp'] \|\| (req as any).hmac?.timestamp,` | Refactor to strict type |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | 81 | `signature: req.headers['x-signature'] \|\| (req as any).hmac?.signature,` | Refactor to strict type |
| `apps/api/src/common/http/http-client.ts` | 37 | `async post<T = any>(path: string, data: any, config?: AxiosRequestConfig): Promise<HttpClientRespons` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.service.ts` | 44 | `const keyRecord = await (this.prisma as any).apiKey.findUnique({` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.service.ts` | 120 | `await (this.prisma as any).apiKey.update({` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.service.ts` | 208 | `details: any,` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 105 | `(request as any).apiKey = keyRecord;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 106 | `(request as any).apiKeyId = keyRecord.id;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 107 | `(request as any).apiKeyOwnerUserId = keyRecord.ownerUserId;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 108 | `(request as any).apiKeyOwnerOrgId = keyRecord.ownerOrgId;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 109 | `(request as any).hmacNonce = nonce;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 110 | `(request as any).hmacTimestamp = timestamp;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 111 | `(request as any).hmacSignature = signature;` | Refactor to strict type |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 114 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 79 | `} catch (error: any) {` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 94 | `const apiKey = await (this.prisma as any).apiKey.create({` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 117 | `delete (result as any).secretHash;` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 118 | `delete (result as any).secretEnc;` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 119 | `delete (result as any).secretEncIv;` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 120 | `delete (result as any).secretEncTag;` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 129 | `return (this.prisma as any).apiKey.findUnique({` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 147 | `return (this.prisma as any).apiKey.update({` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 162 | `return (this.prisma as any).apiKey.update({` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 172 | `const where: any = {};` | Refactor to strict type |
| `apps/api/src/auth/hmac/api-key.service.ts` | 180 | `return (this.prisma as any).apiKey.findMany({` | Refactor to strict type |
| `apps/api/src/auth/guards/timestamp-nonce.guard.ts` | 26 | `private getPath(req: any): string {` | Refactor to strict type |
| `apps/api/src/auth/guards/jwt-or-hmac.guard.ts` | 21 | `private hasJwt(req: any): boolean {` | Refactor to strict type |
| `apps/api/src/auth/guards/jwt-or-hmac.guard.ts` | 30 | `private hasHmac(req: any): boolean {` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 50 | `args: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 55 | `} ? T[symbol]['types']['operations'][F]['args'] : any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 106 | `declare type BatchQueryOptionsCb = (args: BatchQueryOptionsCbArgs) => Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 147 | `[K in string]: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 151 | `$queryRaw<T = unknown>(query: TemplateStringsArray \| Sql, ...values: any[]): PrismaPromise<T>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 153 | `$queryRawUnsafe<T = unknown>(query: string, ...values: any[]): PrismaPromise<T>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 154 | `$executeRaw(query: TemplateStringsArray \| Sql, ...values: any[]): PrismaPromise<number>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 155 | `$executeRawUnsafe(query: string, ...values: any[]): PrismaPromise<number>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 278 | `request(request: T): Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 284 | `singleLoader: (request: T) => Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 302 | `enable(namespace: any): void;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 303 | `disable(): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 319 | `declare function debugCreate(namespace: string): ((...args: any[]) => void) & {` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 546 | `static isDecimal(object: any): object is Decimal;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 639 | `args: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 640 | `result: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 728 | `args: any[];` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 915 | `$transaction<P extends PrismaPromise<any>[]>(arg: [...P], options?: {` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 984 | `args: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 985 | `query: (args: any) => PrismaPromise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 986 | `}) => Promise<any> : K extends '$allModels' ? {` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1011 | `compute(data: DynamicResultExtensionData<TypeMap, ModelKey<TypeMap, K>, R_[K][P]>): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1119 | `debug: (...args: any[]) => void;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1286 | `define: (client: any) => {` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1422 | `include: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1445 | `compute: (...args: any) => infer C;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1451 | `_originalClient: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1454 | `_connectionPromise?: Promise<any> \| undefined;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1455 | `_disconnectionPromise?: Promise<any> \| undefined;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1472 | `_appliedParent: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1497 | `$executeRaw(query: TemplateStringsArray \| Sql, ...values: any[]): PrismaPromise_2<unknown>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1517 | `$queryRawInternal(transaction: PrismaPromiseTransaction \| undefined, clientMethod: string, args: Ra` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1526 | `$queryRaw(query: TemplateStringsArray \| Sql, ...values: any[]): PrismaPromise_2<unknown>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1547 | `promises: Array<PrismaPromise_2<any>>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1549 | `}): Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1567 | `$transaction(input: any, options?: any): Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1573 | `_request(internalParams: InternalRequestParams): Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1574 | `_executeRequest({ args, clientMethod, dataPath, callsite, action, model, argsMapper, transaction, un` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1713 | `error: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1859 | `resolve: (data: any) => void;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1860 | `reject: (data: any) => void;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 1861 | `request: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2035 | `export declare function makeTypedQueryFactory(sql: string): (...values: any[]) => TypedSql<any[], un` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2057 | `getAllQueryCallbacks(jsModelName: string, operation: string): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2148 | `export declare type ModelQueryOptionsCb = (args: ModelQueryOptionsCbArgs) => Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2187 | `forEach(callbackfn: (value: string, key: string, parent: this) => void, thisArg?: any): void;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2300 | `payload: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2303 | `} ? T[symbol]['types']['payload'] : any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2432 | `catch<R = never>(onrejected?: ((reason: any) => R \| PromiseLike<R>) \| undefined \| null, transacti` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2611 | `export declare type QueryOptionsCb = (args: QueryOptionsCbArgs) => Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2683 | `request(params: RequestParams): Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2684 | `mapQueryEngineResult({ dataPath, unpacker }: RequestParams, response: QueryEngineResult<any>): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2691 | `sanitizeMessage(message: any): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2692 | `unpack(data: unknown, dataPath: string[], unpacker?: Unpacker): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2719 | `args?: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2735 | `json: () => Promise<any>;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2756 | `payload: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2811 | `export declare type ResultArgsFieldCompute = (model: any) => unknown;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 2842 | `export declare type Return<T> = T extends (...args: any[]) => infer R ? R : T;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 3312 | `declare type Unpacker = (data: any) => any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 3381 | `export declare function warnEnvConflicts(envPaths: any): void;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/library.d.ts` | 3390 | `__wbg_set_wasm(exports: unknown): any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/index-browser.d.ts` | 9 | `args: any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/index-browser.d.ts` | 14 | `} ? T[symbol]['types']['operations'][F]['args'] : any;` | Refactor to strict type |
| `packages/database/src/generated/prisma/runtime/index-browser.d.ts` | 238 | `static isDecimal(object: any): object is Decimal;` | Refactor to strict type |
| `apps/web/src/components/_legacy/ui/DetailDrawer.tsx` | 15 | `input?: any;` | Refactor to strict type |
| `apps/web/src/components/_legacy/ui/DetailDrawer.tsx` | 16 | `output?: any;` | Refactor to strict type |
| `apps/web/src/components/_legacy/studio/ShotPlanningPanel.tsx` | 29 | `} catch (e: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/studio/ShotPlanningPanel.tsx` | 43 | `} catch (e: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/studio/SemanticInfoPanel.tsx` | 29 | `} catch (e: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/studio/SemanticInfoPanel.tsx` | 43 | `} catch (e: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/studio/QualityHintPanel.tsx` | 28 | `} catch (e: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/studio/QualityHintPanel.tsx` | 42 | `} catch (e: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/project/ContentList.tsx` | 14 | `data: any;` | Refactor to strict type |
| `apps/web/src/components/_legacy/project/ContentList.tsx` | 21 | `onSelectNode?: (node: { type: Level; id: string; data: any }) => void;` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/page.tsx` | 52 | `projectsList.map(async (project: any) => {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/page.tsx` | 83 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/page.tsx` | 110 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/components/_legacy/workbench/overview/FlowProgress.tsx` | 63 | `{(node.gate as any).blockedReason?.message \|\| 'Locked'}` | Refactor to strict type |
| `apps/web/src/components/_legacy/landing/sections/PersonaSection.tsx` | 41 | `onClick={() => handleClick((card as any).link)}` | Refactor to strict type |
| `apps/web/src/components/_legacy/landing/sections/CapabilitiesSection.tsx` | 22 | `link={(card as any).link}` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 113 | `const [jobDetail, setJobDetail] = useState<any>(null);` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 220 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 235 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 266 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 281 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 298 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 312 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 326 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/jobs/page.tsx` | 346 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/studio/review/page.tsx` | 79 | `if ((err as any).statusCode === 401) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page.tsx` | 44 | `const activeModule = (moduleParam \|\| 'overview') as any;` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page.tsx` | 120 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page.tsx` | 365 | `return renderModuleContent(module as any);` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-studio.tsx` | 93 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-studio.tsx` | 111 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-studio.tsx` | 124 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-studio.tsx` | 137 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-studio.tsx` | 150 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 42 | `params?: any;` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 97 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 119 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 136 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 153 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 174 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/monitor/workers/page.tsx` | 7 | `const [stats, setStats] = useState<any>(null);` | Refactor to strict type |
| `apps/web/src/app/[locale]/monitor/workers/page.tsx` | 40 | `{stats.workers.map((w: any) => (` | Refactor to strict type |
| `apps/web/src/app/[locale]/monitor/scheduler/page.tsx` | 11 | `const [stats, setStats] = useState<any>(null);` | Refactor to strict type |
| `apps/web/src/app/[locale]/dev/autofill/page.tsx` | 9 | `const [result, setResult] = useState<any>(null);` | Refactor to strict type |
| `apps/web/src/app/[locale]/dev/autofill/page.tsx` | 23 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/tasks/[taskId]/graph/page.tsx` | 15 | `const [graph, setGraph] = useState<any>(null);` | Refactor to strict type |
| `apps/web/src/app/[locale]/tasks/[taskId]/graph/page.tsx` | 36 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/tasks/[taskId]/graph/page.tsx` | 61 | `const calculateDuration = (job: any) => {` | Refactor to strict type |
| `apps/web/src/app/[locale]/tasks/[taskId]/graph/page.tsx` | 70 | `? graph.jobs?.filter((job: any) => job.engineKey === selectedEngineKey) \|\| []` | Refactor to strict type |
| `apps/web/src/app/[locale]/tasks/[taskId]/graph/page.tsx` | 135 | `{filteredJobs.map((job: any) => {` | Refactor to strict type |
| `apps/web/src/app/[locale]/tasks/[taskId]/graph/page.tsx` | 138 | `const qualityScore = graph.qualityScores?.find((qs: any) => qs.jobId === job.jobId);` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/pipeline/page.tsx` | 72 | `setRoot((data as any).data \|\| data);` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 30 | `payload?: any;` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 103 | `const defaultEngine = data?.find((e: any) => e.engineKey === 'default_novel_analysis');` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 291 | `const e = err as any;` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 353 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 370 | `} catch (err: any) {` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 649 | `.filter((e: any) => e.enabled !== false)` | Refactor to strict type |
| `apps/web/src/app/[locale]/projects/[projectId]/import-novel/page.tsx` | 650 | `.map((engine: any) => (` | Refactor to strict type |

## ⚠️ Medium Risk Items (eslint-disable)

| File | Line | Content | Strategy |
|------|------|---------|----------|
| `tools/dev/audit_eslint_overrides.ts` | 39 | `// Check for eslint-disable` | Remove or justify |
| `tools/dev/audit_eslint_overrides.ts` | 40 | `if (lineContent.includes('eslint-disable') \|\| lineContent.includes('eslint-disable-next-line')) {` | Remove or justify |
| `tools/dev/audit_eslint_overrides.ts` | 93 | `md += `## ⚠️ Medium Risk Items (eslint-disable)\n\n`;` | Remove or justify |
| `tools/dev/audit_eslint_overrides.ts` | 95 | `md += `✅ No eslint-disable patterns found.\n\n`;` | Remove or justify |
| `apps/tools/mock-http-engine/server.ts` | 61 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/web/src/types/global.d.ts` | 4 | `// eslint-disable-next-line no-var` | Remove or justify |
| `apps/api/src/scripts/sync-engines-from-json.ts` | 1 | `/* eslint-disable no-console */` | Remove or justify |
| `apps/api/src/scripts/e2e-novel-worker-pipeline.ts` | 332 | `// eslint-disable-next-line no-constant-condition` | Remove or justify |
| `apps/api/src/scripts/create-novel-analysis-http-test-jobs.ts` | 1 | `/* eslint-disable no-console */` | Remove or justify |
| `apps/api/src/prisma/prisma.service.ts` | 11 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/prisma/prisma.service.ts` | 19 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/pipeline/pipeline.service.ts` | 238 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/novel-import/file-parser.service.ts` | 1 | `/* eslint-disable @typescript-eslint/ban-ts-comment, no-useless-escape, no-empty-character-class */` | Remove or justify |
| `apps/api/src/engine/engine-registry.service.ts` | 42 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/engine/engine-config-store.service.ts` | 4 | `// eslint-disable-next-line @typescript-eslint/no-var-requires` | Remove or justify |
| `apps/api/src/auth/nonce.service.ts` | 41 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/auth/nonce.service.ts` | 70 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/auth/nonce.service.ts` | 100 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/auth/nonce.service.ts` | 109 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/api/src/auth/nonce.service.ts` | 153 | `// eslint-disable-next-line no-console` | Remove or justify |
| `apps/web/src/components/project/ProjectStructureTree.tsx` | 113 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |
| `apps/web/src/components/auth/UnauthorizedRedirectProvider.tsx` | 28 | `// eslint-disable-next-line no-var` | Remove or justify |
| `apps/api/src/auth/hmac/hmac-auth.guard.ts` | 74 | `/* eslint-disable no-console */` | Remove or justify |
| `apps/web/src/components/_legacy/studio/ShotPlanningPanel.tsx` | 52 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |
| `apps/web/src/components/_legacy/studio/SemanticInfoPanel.tsx` | 52 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |
| `apps/web/src/components/_legacy/studio/QualityHintPanel.tsx` | 51 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |
| `apps/web/src/app/[locale]/tasks/page.tsx` | 166 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/page.tsx` | 107 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/page-studio.tsx` | 1 | `/* eslint-disable @typescript-eslint/ban-ts-comment */` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/page-old.tsx` | 1 | `/* eslint-disable @typescript-eslint/ban-ts-comment */` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/pipeline/page.tsx` | 71 | `// eslint-disable-next-line @typescript-eslint/no-explicit-any` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/pipeline/page.tsx` | 73 | `} catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/pipeline/page.tsx` | 74 | `// eslint-disable-next-line @typescript-eslint/no-explicit-any` | Remove or justify |
| `apps/web/src/app/[locale]/projects/[projectId]/pipeline/page.tsx` | 84 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Remove or justify |

