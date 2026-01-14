# STAGE-1 SEAL INDEX

**Status**: SEALED  
**Seal Date**: 2026-01-14T01:04:37+07:00  
**Seal Tag**: `seal_stage1_s1-sec-patch_20260114`

---

## Evidence Archive

### Primary Evidence
- **Primary Gate Run**: `docs/_evidence/STAGE1_GATE_20260114_080427/`
- **Rerun Verification**: `docs/_evidence/STAGE1_GATE_RERUN_20260114_080437.log`
- **Initial Gate (Pre-Patch)**: `docs/_evidence/STAGE1_GATE_20260114_002846/`

### Gate Script
- **Path**: `tools/gate/gates/gate-stage1_novel_to_prod_video.sh`
- **Commit SHA**: (To be filled by git commit)

---

## Seal Criteria

### Positive Path ✅
- Pipeline API trigger → PublishedVideo generation
- Asset metadata: `storageKey`, `checksum` (mock: `mock-checksum-mvp`)
- Status: `PUBLISHED` (符合 Schema 定义)

### Negative Path ✅
- **Assertion**: `jq '.error.code == "4003"'` (APISpec V1.1)
- **Test Case**: Invalid Signature (随机 nonce 避免 4004 重放)
- **Expected Response**: 
  ```json
  {
    "success": false,
    "error": {
      "code": "4003",
      "message": "Invalid signature"
    }
  }
  ```

---

## S1-SEC-PATCH Summary

**Root Cause**: `JwtOrHmacGuard.hasHmac()` 要求四字段齐全才路由至 `HmacAuthGuard`，导致错误签名被误判为"无鉴权"（401）。

**Fix**: 
1. 添加大小写不敏感的 `getHeader()` 方法
2. 修改 `hasHmac()` 为"存在任一 HMAC 头即路由"（`return !!(apiKey || sig || nonce || ts)`）
3. 强化 Gate 负测断言，严格验证 `error.code=4003`
4. 随机生成 nonce 避免触发 4004 防重放

**Modified Files**:
- `apps/api/src/auth/guards/jwt-or-hmac.guard.ts`
- `tools/gate/gates/gate-stage1_novel_to_prod_video.sh`

---

## Regression Baseline

- **Typecheck**: ✅ PASS (12/12 tasks successful)
- **Lint**: (Skipped - not enforced in current phase)
- **Gate**: ✅ PASS (Exit Code 0)

---

## Reproducibility

To reproduce this seal:

```bash
# 1. Checkout sealed commit
git checkout seal_stage1_s1-sec-patch_20260114

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp .env.example .env.local  # Configure DATABASE_URL, TEST_API_KEY, etc.

# 4. Start services
pnpm dev:api &
cd apps/workers && GATE_MODE=1 npx ts-node -r tsconfig-paths/register src/main.ts &

# 5. Run gate
bash tools/gate/gates/gate-stage1_novel_to_prod_video.sh

# Expected: Exit Code 0, negative test returns error.code=4003
```

---

## Notes

- **S1-SEC-PATCH** routes any HMAC-looking request (存在任一 HMAC 头) to `HmacAuthGuard` to avoid 401 downgrade, ensuring APISpec V1.1 compliance (签名不合法必须返回 4003)
- Mock Asset 场景下 FFprobe 验证被正确跳过
- Worker 已实现多租户权限穿透（Org ID Header 透传）
- Reference Sheet Mock 机制避免 E4 外键约束

---

**Sealed By**: Antigravity AI  
**Walkthrough**: [/Users/adam/.gemini/antigravity/brain/195903ac-3cd2-47ea-b064-d31c3c5399f7/walkthrough.md](file:///Users/adam/.gemini/antigravity/brain/195903ac-3cd2-47ea-b064-d31c3c5399f7/walkthrough.md)
