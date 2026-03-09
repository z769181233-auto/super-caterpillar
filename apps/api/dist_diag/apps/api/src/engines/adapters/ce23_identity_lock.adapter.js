"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CE23IdentityLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE23IdentityLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const ppv64_1 = require("../../../../../packages/shared/vision/ppv64");
const fs_1 = require("fs");
const fs_safe_1 = require("../../../../../packages/shared/fs_safe");
const hash_1 = require("../../../../../packages/shared/hash");
const crypto_1 = require("crypto");
const perf_hooks_1 = require("perf_hooks");
let CE23IdentityLocalAdapter = CE23IdentityLocalAdapter_1 = class CE23IdentityLocalAdapter {
    name = 'ce23_identity_consistency';
    logger = new common_1.Logger(CE23IdentityLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'ce23_identity_consistency';
    }
    async invoke(input) {
        const { anchorImageKey, targetImageKey, characterId } = input.payload;
        const traceId = input.context?.traceId || 'unknown';
        const t0 = perf_hooks_1.performance.now();
        this.logger.log(`[CE23_ADAPTER] Scoring ${characterId} for traceId=${traceId}`);
        try {
            const storageRoot = process.env.STORAGE_ROOT || '.runtime';
            const anchorPath = (0, fs_safe_1.safeJoin)(storageRoot, anchorImageKey);
            const targetPath = (0, fs_safe_1.safeJoin)(storageRoot, targetImageKey);
            const [anchorExists, targetExists] = await Promise.all([
                fs_1.promises
                    .access(anchorPath)
                    .then(() => true)
                    .catch(() => false),
                fs_1.promises
                    .access(targetPath)
                    .then(() => true)
                    .catch(() => false),
            ]);
            if (!anchorExists)
                throw new Error(`ANCHOR_NOT_FOUND: ${anchorImageKey}`);
            if (!targetExists)
                throw new Error(`TARGET_NOT_FOUND: ${targetImageKey}`);
            const [vecAnchor, vecTarget] = await Promise.all([
                (0, ppv64_1.ppv64FromImage)(anchorPath),
                (0, ppv64_1.ppv64FromImage)(targetPath),
            ]);
            const score = (0, ppv64_1.ppv64Similarity)(vecAnchor, vecTarget);
            const [anchorHash, targetHash] = await Promise.all([
                (0, hash_1.sha256File)(anchorPath),
                (0, hash_1.sha256File)(targetPath),
            ]);
            const floatArray = new Float32Array(vecTarget);
            const embeddingHash = (0, crypto_1.createHash)('sha256')
                .update(Buffer.from(floatArray.buffer))
                .digest('hex');
            const threshold = parseFloat(process.env.CE23_THRESHOLD || '0.92');
            const output = {
                identity_score: score,
                threshold_config: threshold,
                is_consistent: score >= threshold,
                provider: 'real-ppv64-v1',
                embedding_hash: embeddingHash,
                details: {
                    anchor_sha256: anchorHash,
                    target_sha256: targetHash,
                    algo: 'ppv64_v1',
                    dims: 64,
                    score_mapping: 'cosine_normalized_0_1',
                },
            };
            const t1 = perf_hooks_1.performance.now();
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output,
                metrics: {
                    durationMs: Math.round(t1 - t0),
                },
            };
        }
        catch (error) {
            this.logger.error(`[CE23_ADAPTER] Failed: ${error.message}`);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: {
                    code: 'CE23_ADAPTER_FAIL',
                    message: error.message,
                },
            };
        }
    }
};
exports.CE23IdentityLocalAdapter = CE23IdentityLocalAdapter;
exports.CE23IdentityLocalAdapter = CE23IdentityLocalAdapter = CE23IdentityLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], CE23IdentityLocalAdapter);
//# sourceMappingURL=ce23_identity_lock.adapter.js.map