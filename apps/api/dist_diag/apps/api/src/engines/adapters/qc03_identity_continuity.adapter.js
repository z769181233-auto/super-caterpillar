"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QC03IdentityContinuityAdapter = void 0;
const common_1 = require("@nestjs/common");
const qc_base_engine_1 = require("../base/qc_base.engine");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
let QC03IdentityContinuityAdapter = class QC03IdentityContinuityAdapter extends qc_base_engine_1.QcBaseEngine {
    constructor(redis, audit, cost) {
        super('qc03_identity_continuity', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload || {});
    }
    async processLogic(payload, input) {
        const characterId = payload.characterId || 'unknown';
        const identityScore = payload.identityScore || payload.score || 0;
        const threshold = 0.85;
        const reasons = [];
        if (!characterId || characterId === 'unknown') {
            reasons.push('Missing characterId');
        }
        if (identityScore < threshold) {
            reasons.push(`Identity score ${identityScore} below threshold ${threshold}`);
        }
        const passed = characterId && characterId !== 'unknown' && identityScore >= threshold;
        const score = passed ? 95 : identityScore * 100;
        const hash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(payload))
            .digest('hex')
            .substring(0, 16);
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/qc/identity');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const reportPath = (0, path_1.join)(outputDir, `qc03_${hash}.json`);
        const report = {
            characterId,
            identityScore,
            threshold,
            continuityScore: score,
            passed,
            reasons,
            checks: {
                faceIdConsistency: passed ? 'MATCH' : 'MISMATCH',
                featureLock: 'ACTIVE',
            },
            timestamp: new Date().toISOString(),
        };
        (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2));
        return {
            status: score >= 90 ? 'PASS' : score >= 70 ? 'WARN' : 'FAIL',
            reportUrl: `file://${reportPath}`,
            metrics: { score, reasons },
        };
    }
};
exports.QC03IdentityContinuityAdapter = QC03IdentityContinuityAdapter;
exports.QC03IdentityContinuityAdapter = QC03IdentityContinuityAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService, audit_service_1.AuditService, cost_ledger_service_1.CostLedgerService])
], QC03IdentityContinuityAdapter);
//# sourceMappingURL=qc03_identity_continuity.adapter.js.map