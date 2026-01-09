# HEALTHCHECK FINDINGS

## 1. Architecture Consistency

### [Finding A-1] Dual-Worker Conflict

- **Evidence**: `apps/api/src/job/job-worker.service.ts` implements a polling/processing loop for jobs, while `apps/workers` implements a standalone processor.
- **Impact**: If both are enabled, they will compete for jobs without coordinated locking, leading to race conditions.
- **Level**: **P0**

### [Finding A-2] Non-Atomic Job Reservation

- **Evidence**: `JobWorkerService.processJobs` in `apps/api` uses `findMany` followed by in-memory filtering.
- **Impact**: No transaction-level "SELECT FOR UPDATE" or atomic state transition exists at the point of pick-up.
- **Level**: **P0**

## 2. Configuration & Environment

### [Finding B-1] Environment Override Trap

- **Evidence**: `packages/config/src/env.ts` uses `dotenv.config({ path: envLocalPath, override: true })`.
- **Impact**: Shell variables (essential for CI/CD and Docker) are silently discarded if a `.env.local` exists. This is the root cause of "split-brain" database connectivity.
- **Level**: **P0**

## 3. Security Link

### [Finding D-1] HMAC Authorization Bypass

- **Evidence**: `apps/api/src/auth/permissions.guard.ts:40` contains `if (request.authType === 'hmac') return true;`.
- **Impact**: Any valid API Key holder can perform any action on any resource, regardless of role or ownership.
- **Level**: **P0**

### [Finding D-2] Improper Security Guard Order

- **Evidence**: `AppModule` registers `PermissionsGuard` (Guard) and `HmacSignatureInterceptor` (Interceptor).
- **Impact**: NestJS runs Guards BEFORE Interceptors. Permission checks occur before the HMAC signature is actually verified. An attacker can trigger heavy permission/DB logic without a valid signature.
- **Level**: **P0**

## 4. Smoke / E2E Fidelity

### [Finding E-1] Suppression of Static Analysis

- **Evidence**: `tools/smoke/run_all.sh` treats lint failures as non-blocking.
- **Impact**: Critical structural errors (like the `require('@nestjs/common').Logger` issue found earlier) can reach runtime.
- **Level**: **P1**
