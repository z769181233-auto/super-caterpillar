## RC1 3-run Verification Log (2025年12月17日 星期三 07时45分16秒 UTC)

### Run 1

```
🚀 Starting E2E Vertical Slice Verification (RC1)...
API_BASE_URL=http://localhost:3000/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/scu?schema=public
WORKER_API_KEY=ak_e2e_test_key_001
Connection to localhost port 5433 [tcp/pyrrho] succeeded!
🚀 Starting API...
API PID: 5193
⏳ Waiting for API (localhost:3000)...
Connection to localhost port 3000 [tcp/hbci] succeeded!
✅ API is up!
🚀 Starting Worker loop...
Worker loop PID: 5347
⏳ Waiting 15s for Worker to initialize...
🧪 Running e2e_verify.ts ...
🚀 Starting E2E Vertical Slice Verification (RC1 - JWT Flow)...
Target: http://localhost:3000/api
User: e2e_auto_7fdf3c1a@scu.test
DB URL: postgresql://postgres:***@localhost:5433/scu?schema=public
👤 Registering Test User...
✅ Logged in. UserId=e21a6d16-041e-4aca-92f6-9fba54f97009
✅ Verified User exists in DB.
📦 Seeding Project Data...
📦 Seeding Worker API Key: ak_e2e_test_key_001
✅ Data Ready: Shot=176db862-049e-4bd7-b5d4-f6bec5c828bb, Member=e21a6d16-041e-4aca-92f6-9fba54f97009, Engine & ApiKey seeded
🔄 Refreshing Token (Re-Login)...
✅ Token Refreshed.

🧪 Test Case A: Fail Fast (Worker Logic Check)
   Job Injected: 4621b48f-5de1-4421-a534-20fb92d90f8f
   Poll 1: PENDING Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 6: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 11: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 16: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 21: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 26: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 31: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 36: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 41: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 46: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 51: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 56: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 61: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 66: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 71: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 76: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 81: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 86: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 91: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 96: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 101: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 106: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 111: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
   Poll 116: DISPATCHED Binding: {"id":"e9961720-66cf-49df-bcab-85ac8cf8c9ce","jobId":"4621b48f-5de1-4421-a534-20fb92d90f8f","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:39:14.449Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:39:14.449Z","updatedAt":"2025-12-17T07:39:14.449Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:39:14.363Z"},"engineVersion":null}
❌ E2E Failed: Error: Timeout polling 4621b48f-5de1-4421-a534-20fb92d90f8f
    at pollJob (tools/smoke/e2e_verify.ts:304:11)
    at async main (tools/smoke/e2e_verify.ts:246:9)
❌ E2E Verification Failed! exit=1
📋 Worker Log Tail:
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=002b7441... timestamp=1765957204553
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=545fb7a7... timestamp=1765957205566
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=f2a1bbab... timestamp=1765957207568
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=9340599d... timestamp=1765957209553
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=2b4c8e9e... timestamp=1765957209568
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=f8a25eb9... timestamp=1765957211569
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=13ad1d4a... timestamp=1765957213570
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=c1f27799... timestamp=1765957214554
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=d71eae68... timestamp=1765957215572
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=06831188... timestamp=1765957217572
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=50c7e9ee... timestamp=1765957219555
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=e4666af0... timestamp=1765957219572
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=5d6edda4... timestamp=1765957221574
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=68800137... timestamp=1765957223574
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=e066f549... timestamp=1765957224556
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=6932a0a0... timestamp=1765957225575
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=b0274f1b... timestamp=1765957227575
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=490256c9... timestamp=1765957229558
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=32665c0a... timestamp=1765957229576
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=feb61784... timestamp=1765957231577
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=d034160a... timestamp=1765957233579
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=728ffc66... timestamp=1765957234559
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=ba86eb99... timestamp=1765957235579
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=f4a19627... timestamp=1765957237580
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=ff858322... timestamp=1765957239560
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=d8b7fd4c... timestamp=1765957239580
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=97f314ec... timestamp=1765957241582
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=6df15174... timestamp=1765957243583
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=183ddd0a... timestamp=1765957244561
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c1180b3e... timestamp=1765957245583
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=3f7e3070... timestamp=1765957247585
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=6e57b230... timestamp=1765957249562
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=60ff65d6... timestamp=1765957249585
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=712a2bc9... timestamp=1765957251585
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=ebb9fd0f... timestamp=1765957253587
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=577a7784... timestamp=1765957254564
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=9b34a9dc... timestamp=1765957255588
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=9826178f... timestamp=1765957257594
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=e4a640c8... timestamp=1765957259565
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=0f3f4d05... timestamp=1765957259593
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=1245f25c... timestamp=1765957261594
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c06c8e87... timestamp=1765957263594
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=5f6cff94... timestamp=1765957264566
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=90cba83b... timestamp=1765957265594
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=a42865b8... timestamp=1765957267595
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=90f7bb76... timestamp=1765957269567
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=a6601d2d... timestamp=1765957269596
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=b52d61cc... timestamp=1765957271597
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=cd369622... timestamp=1765957273598
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=af4269f3... timestamp=1765957274568
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=2629ac12... timestamp=1765957275599
📋 API Log Tail:
apps/api dev:       },
apps/api dev:       "remoteAddress": "::1",
apps/api dev:       "remotePort": 60914
apps/api dev:     }
apps/api dev:     res: {
apps/api dev:       "statusCode": 200,
apps/api dev:       "headers": {
apps/api dev:         "x-powered-by": "Express",
apps/api dev:         "access-control-allow-origin": "http://localhost:3001",
apps/api dev:         "vary": "Origin",
apps/api dev:         "access-control-allow-credentials": "true",
apps/api dev:         "x-ratelimit-limit": "100",
apps/api dev:         "x-ratelimit-remaining": "41",
apps/api dev:         "x-ratelimit-reset": "59",
apps/api dev:         "content-type": "application/json; charset=utf-8",
apps/api dev:         "content-length": "2933",
apps/api dev:         "etag": "W/\"b75-T7jzV9mkgFL/N+4lImhKMqH/PF0\""
apps/api dev:       }
apps/api dev:     }
apps/api dev:     responseTime: 17
🧹 Cleanup...
tools/smoke/run_e2e_vertical_slice.sh: line 32:  5347 Terminated: 15          ( while true; do
    echo "[Runner] Starting worker..." >> worker.log; pnpm -w --filter @scu/worker dev >> worker.log 2>&1; echo "[Runner] Worker exited with $?. Restarting in 2s..." >> worker.log; sleep 2;
done )
```

### Run 2

```
🚀 Starting E2E Vertical Slice Verification (RC1)...
API_BASE_URL=http://localhost:3000/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/scu?schema=public
WORKER_API_KEY=ak_e2e_test_key_001
Connection to localhost port 5433 [tcp/pyrrho] succeeded!
🚀 Starting API...
API PID: 6583
⏳ Waiting for API (localhost:3000)...
Connection to localhost port 3000 [tcp/hbci] succeeded!
✅ API is up!
🚀 Starting Worker loop...
Worker loop PID: 6585
⏳ Waiting 15s for Worker to initialize...
🧪 Running e2e_verify.ts ...
🚀 Starting E2E Vertical Slice Verification (RC1 - JWT Flow)...
Target: http://localhost:3000/api
User: e2e_auto_e7ff9c3c@scu.test
DB URL: postgresql://postgres:***@localhost:5433/scu?schema=public
👤 Registering Test User...
✅ Logged in. UserId=e639594f-210f-4f4e-92d8-aff499b14b8f
✅ Verified User exists in DB.
📦 Seeding Project Data...
📦 Seeding Worker API Key: ak_e2e_test_key_001
✅ Data Ready: Shot=f4ef33fb-de11-48fa-a849-a232916a703d, Member=e639594f-210f-4f4e-92d8-aff499b14b8f, Engine & ApiKey seeded
🔄 Refreshing Token (Re-Login)...
✅ Token Refreshed.

🧪 Test Case A: Fail Fast (Worker Logic Check)
   Job Injected: 672aecc6-bb32-4547-b84d-9c61609bef25
   Poll 1: PENDING Binding: {"id":"bb96515a-da82-4314-8d9d-410511921810","jobId":"672aecc6-bb32-4547-b84d-9c61609bef25","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:38.182Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:38.182Z","updatedAt":"2025-12-17T07:42:38.182Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:38.093Z"},"engineVersion":null}
🧹 Cleanup...
tools/smoke/run_e2e_vertical_slice.sh: line 32:  6585 Terminated: 15          ( while true; do
    echo "[Runner] Starting worker..." >> worker.log; pnpm -w --filter @scu/worker dev >> worker.log 2>&1; echo "[Runner] Worker exited with $?. Restarting in 2s..." >> worker.log; sleep 2;
done )
```

### Run 3

```
🚀 Starting E2E Vertical Slice Verification (RC1)...
API_BASE_URL=http://localhost:3000/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/scu?schema=public
WORKER_API_KEY=ak_e2e_test_key_001
Connection to localhost port 5433 [tcp/pyrrho] succeeded!
🚀 Starting API...
API PID: 7079
⏳ Waiting for API (localhost:3000)...
Connection to localhost port 3000 [tcp/hbci] succeeded!
✅ API is up!
🚀 Starting Worker loop...
Worker loop PID: 7081
⏳ Waiting 15s for Worker to initialize...
🧪 Running e2e_verify.ts ...
🚀 Starting E2E Vertical Slice Verification (RC1 - JWT Flow)...
Target: http://localhost:3000/api
User: e2e_auto_f7cb3fe4@scu.test
DB URL: postgresql://postgres:***@localhost:5433/scu?schema=public
👤 Registering Test User...
✅ Logged in. UserId=cbe13afe-704f-4030-835e-07ba35d4eceb
✅ Verified User exists in DB.
📦 Seeding Project Data...
📦 Seeding Worker API Key: ak_e2e_test_key_001
✅ Data Ready: Shot=46550720-0ee0-485b-81f9-9aade99521ec, Member=cbe13afe-704f-4030-835e-07ba35d4eceb, Engine & ApiKey seeded
🔄 Refreshing Token (Re-Login)...
✅ Token Refreshed.

🧪 Test Case A: Fail Fast (Worker Logic Check)
   Job Injected: 19545e32-6438-4521-8ef8-7acdf68ddead
   Poll 1: PENDING Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 6: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 11: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 16: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 21: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 26: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 31: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 36: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 41: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 46: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 51: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 56: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 61: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 66: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 71: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 76: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 81: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 86: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 91: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 96: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 101: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 106: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 111: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
   Poll 116: DISPATCHED Binding: {"id":"537db48a-f232-43c9-87f2-1044d5e48b24","jobId":"19545e32-6438-4521-8ef8-7acdf68ddead","engineId":"c9e6943c-24b4-4596-8d5b-a132343efd3a","engineVersionId":null,"engineKey":"default_novel_analysis","status":"BOUND","boundAt":"2025-12-17T07:42:55.296Z","executedAt":null,"completedAt":null,"errorMessage":null,"metadata":null,"createdAt":"2025-12-17T07:42:55.296Z","updatedAt":"2025-12-17T07:42:55.296Z","engine":{"id":"c9e6943c-24b4-4596-8d5b-a132343efd3a","code":"default_novel_analysis","name":"default_novel_analysis","type":"local","isActive":true,"engineKey":"default_novel_analysis","adapterName":"default_novel_analysis","adapterType":"local","config":{},"enabled":true,"version":null,"defaultVersion":null,"createdAt":"2025-12-16T03:47:08.863Z","updatedAt":"2025-12-17T07:42:55.209Z"},"engineVersion":null}
❌ E2E Failed: Error: Timeout polling 19545e32-6438-4521-8ef8-7acdf68ddead
    at pollJob (tools/smoke/e2e_verify.ts:304:11)
    at async main (tools/smoke/e2e_verify.ts:246:9)
❌ E2E Verification Failed! exit=1
📋 Worker Log Tail:
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=3fd3ba9d... timestamp=1765957461380
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=1541e9a1... timestamp=1765957461700
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=1cdc25b8... timestamp=1765957463381
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=c2e581ff... timestamp=1765957463701
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=ad2097ab... timestamp=1765957464607
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=672a6854... timestamp=1765957465382
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=84106d9f... timestamp=1765957465702
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=bffbe3b3... timestamp=1765957466357
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=edcb8e3e... timestamp=1765957467383
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=ff9a9daf... timestamp=1765957467703
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=ed250acf... timestamp=1765957469384
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=2bf19a38... timestamp=1765957469607
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=1f6f4bb9... timestamp=1765957469703
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=fb62d903... timestamp=1765957471358
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=5e430aa4... timestamp=1765957471385
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=dcf62081... timestamp=1765957471704
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=64313c7a... timestamp=1765957473387
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=5d06f196... timestamp=1765957473705
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=4587d4d9... timestamp=1765957474608
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=44b8bfda... timestamp=1765957475388
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=132e8587... timestamp=1765957475706
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=f128eb82... timestamp=1765957476359
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=b2f0daaa... timestamp=1765957477389
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=0c27e5c2... timestamp=1765957477706
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=a9af5471... timestamp=1765957479390
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=eb3bbc41... timestamp=1765957479609
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=39b6b4fb... timestamp=1765957479708
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=20681fed... timestamp=1765957481360
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=e03cf1a2... timestamp=1765957481391
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=4165fad9... timestamp=1765957481709
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=541d8308... timestamp=1765957483392
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=35ad44ef... timestamp=1765957483709
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=6740dc2a... timestamp=1765957484610
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=9f3c1659... timestamp=1765957485393
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=92ea786b... timestamp=1765957485711
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=de8de208... timestamp=1765957486361
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=8c31e2b0... timestamp=1765957487394
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=719027bf... timestamp=1765957487712
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=303439d0... timestamp=1765957489395
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=3f6fd2ac... timestamp=1765957489611
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=0d250d1f... timestamp=1765957489714
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=570335ce... timestamp=1765957491363
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=9a9ce1cd... timestamp=1765957491395
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=97541124... timestamp=1765957491715
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=f13c299f... timestamp=1765957493395
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=cfdeb496... timestamp=1765957493716
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=7125a173... timestamp=1765957494612
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=150cd24b... timestamp=1765957495397
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=a3607b60... timestamp=1765957495717
apps/workers dev: DEBUG: heartbeat params (FIXED): {"workerId":"local-worker","status":"idle","tasksRunning":0}
apps/workers dev: DEBUG: heartbeat body ACTUAL: {"status":"idle","tasksRunning":0}
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/heartbeat nonce=7bc9b984... timestamp=1765957496364
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=ac101c41... timestamp=1765957497398
apps/workers dev: [Worker HMAC_V2] POST /api/workers/local-worker/jobs/next nonce=20cc166f... timestamp=1765957497718
📋 API Log Tail:
apps/api dev: [HMAC DEBUG] {
apps/api dev:   method: 'POST',
apps/api dev:   path: '/api/workers/local-worker/jobs/next',
apps/api dev:   headers: {
apps/api dev:     'x-api-key': 'ak_e2e_test_key_001',
apps/api dev:     'x-nonce': 'ac101c41d07e60757d97ad8d25385f06',
apps/api dev:     'x-timestamp': '1765957497398',
apps/api dev:     'x-signature': '149ff4ca7b9e4890b61a5de99f9c77c6ba9b71b17f919b4b0d397db963fe1bbb'
apps/api dev:   }
apps/api dev: }
apps/api dev: [HMAC DEBUG] {
apps/api dev:   method: 'POST',
apps/api dev:   path: '/api/workers/local-worker/jobs/next',
apps/api dev:   headers: {
apps/api dev:     'x-api-key': 'ak_e2e_test_key_001',
apps/api dev:     'x-nonce': '20cc166ff8b65e8b3493d9c9212a379a',
apps/api dev:     'x-timestamp': '1765957497718',
apps/api dev:     'x-signature': 'a5545fab140b67a0a19c1ac53d3b759a90c07d4c26f63ca5fc83dce11b7b88b2'
apps/api dev:   }
apps/api dev: }
🧹 Cleanup...
tools/smoke/run_e2e_vertical_slice.sh: line 32:  7081 Terminated: 15          ( while true; do
    echo "[Runner] Starting worker..." >> worker.log; pnpm -w --filter @scu/worker dev >> worker.log 2>&1; echo "[Runner] Worker exited with $?. Restarting in 2s..." >> worker.log; sleep 2;
done )
```
