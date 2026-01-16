# Stage 4: Industrial Scale Architecture Specification (V1.0)

> [!IMPORTANT]
> **Target**: Support 3M - 15M words novel import.
> **Constraint**: Zero OOM (Out of Memory), Zero Transaction Timeout.
> **Method**: Streaming Upload + Lazy Scanning + Job Fan-out.

---

## 1. New Workflow: "The Shredder" (分片流)

Instead of one huge `NOVEL_ANALYSIS` job, we split the process into 3 distinct stages:

### Phase 1: Upload & Register (API Layer)
*   **Input**: User uploads `.txt` file via presigned URL to S3/MinIO (simulated via file system for now).
*   **Action**: creating `NovelSource` record with `status=PENDING`.
*   **Trigger**: Dispatch **Job A**: `NOVEL_SCAN_TOC` (Table of Contents).

### Phase 2: Lazy Scanning (Worker Layer - Job A)
*   **Job**: `NOVEL_SCAN_TOC`
*   **Logic**:
    *   Stream read the file (ReadStream).
    *   Regex match "Chapter Titles" (第X章).
    *   **Output**: `Season` / `Episode` skeletons ONLY. (No Body Text).
    *   **Action**: Batch insert `Episode` records (Lightweight).
    *   **Trigger**: Dispatch N x **Job B**: `NOVEL_CHUNK_PARSE`.

### Phase 3: Parallel Parsing (Worker Layer - Job B)
*   **Job**: `NOVEL_CHUNK_PARSE` (Payload: `fileKey`, `startByte`, `endByte`, `episodeId`)
*   **Logic**:
    *   Read specific byte range from file.
    *   Call LLM/Regex to parse `Scenes` & `Shots` for *just this chapter*.
    *   **Action**: Transactional insert for *just this chapter* (Small transaction).
    *   **Metrics**: Update `NovelSource` progress (`chunks_completed / total_chunks`).

---

## 2. Data Structures

### New Job Types
```typescript
enum JobType {
  NOVEL_SCAN_TOC = 'NOVEL_SCAN_TOC',       // Scanner
  NOVEL_CHUNK_PARSE = 'NOVEL_CHUNK_PARSE'  // Worker
}
```

### Job Payloads
**NOVEL_SCAN_TOC**:
```json
{
  "projectId": "uuid",
  "fileKey": "uploads/novels/123.txt"
}
```

**NOVEL_CHUNK_PARSE**:
```json
{
  "projectId": "uuid",
  "episodeId": "uuid",
  "fileKey": "uploads/novels/123.txt",
  "startLine": 100,
  "endLine": 500,
  "parseOptions": { "depth": "standard" }
}
```

---

## 3. Migration Plan

1.  **Deprecate**: `basicTextSegmentation` (Monolithic).
2.  **Implement**: `StreamScanner` class.
3.  **Refactor**: `CE06` engine to support `parseChunk(text)`.
4.  **UI**: Update frontend to poll `progress` instead of waiting for single job completion.

---

## 4. Risk Mitigation

*   **Concurrency**: Limit `NOVEL_CHUNK_PARSE` concurrency to 5-10 per worker to avoid Rate Limit (LLM) or DB Pool exhaustion.
*   **Idempotency**: `CHUNK_PARSE` must delete existing scenes for that `episodeId` before inserting (allow retry).
