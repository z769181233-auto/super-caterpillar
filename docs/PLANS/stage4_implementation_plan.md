# Stage 4: Industrial Scale Implementation Plan (The Shredder)

> **Goal**: Enable import of 3M - 15M word novels with zero OOM and zero transaction timeouts.
> **Current Status**: Core logic (Scan + Chunk Parse) exists but untested at scale. API layer missing. Cascade control missing.
> **Target Delivery**: Week 4

## 1. Gap Analysis

| Component        | Status       | Issue                                | Impact                                                                           |
| :--------------- | :----------- | :----------------------------------- | :------------------------------------------------------------------------------- |
| **API Layer**    | ❌ Missing   | Relies on local file system path     | Cannot handle user uploads from web/client                                       |
| **Scanner**      | ⚠️ Prototype | Verified for 100 chapters (~30KB)    | Unknown behavior for 10,000 chapters (30MB)                                      |
| **Parser**       | ⚠️ Unbounded | Triggers downstream jobs immediately | At 10k chapters, creates 10k-50k concurrent jobs, potentially crashing DB/Worker |
| **Verification** | ❌ Missing   | No test for >100 chapters            | High risk of failure at target scale (3M words)                                  |

## 2. Implementation Strategy

### Phase 1: API Layer & Upload (Week 1)

**Objective**: Allow users to upload large files safely.

- [ ] Implement `POST /api/novels/upload` (Presigned URL or Multipart Stream).
- [ ] Integrate Object Storage (S3/MinIO/Local-Blob-Store).
- [ ] Update `NOVEL_SCAN_TOC` to read from Storage Adapter.

### Phase 2: Scaling Controls (Week 1-2)

**Objective**: Prevent system collapse under load.

- [ ] **Throttling**: Implement concurrency limits for `NOVEL_CHUNK_PARSE` (e.g., max 50 concurrent per worker).
- [ ] **Backpressure**: Monitor Queue Depth before dispatching new chunks from Scanner? (Or let BullMQ handle it).
- [ ] **Cascade Optimization**:
  - Verify `createMany` efficiency for 10,000+ records.
  - Consider "Lazy Trigger" for downstream CE11 jobs (don't create immediately, or create in `paused` state).

### Phase 3: "The Shredder" Hardening (Week 2)

**Objective**: Robustness for 15M words.

- [ ] **Memory Profiling**: Ensure `Scan` stream never exceeds 50MB RSS.
- [ ] **Transaction Timeout**: Ensure `Chunk Parse` transaction is always < 2s.
- [ ] **Error Handling**: Retry mechanism for failed chunks without restarting entire scan.

### Phase 4: Verification (Week 3)

**Objective**: Prove it works.

- [ ] **Benchmark A**: 3M words (approx 10,000 chapters).
  - Success Criteria: < 1 hour total processing. Zero failure.
- [ ] **Benchmark B**: 15M words (approx 50,000 chapters).
  - Success Criteria: System remains responsive.

## 3. Immediate Action Items (Today)

1.  **Scale Test (Baseline)**:
    - Create `gate-stage4-scale-3m.sh`.
    - Generate 3M word mock novel (10,000 chapters).
    - Run `NOVEL_SCAN_TOC` and observe behavior.
    - **Expectation**: Likely DB timeout or identifying bottleneck.

2.  **Fix API**:
    - Implement simple upload endpoint using stream to file (MVP).

3.  **Optimize Cascade**:
    - Review `novel-chunk.processor.ts` cascade logic.

## 4. Risks

- **DB Connection Pool**: 10k jobs might exhaust PG connections if not limited.
- **Worker Memory**: If too many chunks run in parallel, Node.js heap might limit out.
