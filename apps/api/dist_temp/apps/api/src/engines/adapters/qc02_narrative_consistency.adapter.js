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
exports.QC02NarrativeConsistencyAdapter = void 0;
const common_1 = require("@nestjs/common");
const qc_base_engine_1 = require("../base/qc_base.engine");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
let QC02NarrativeConsistencyAdapter = class QC02NarrativeConsistencyAdapter extends qc_base_engine_1.QcBaseEngine {
    constructor(redis, audit, cost) {
        super('qc02_narrative_consistency', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload || {});
    }
    async processLogic(payload, input) {
        const required = ['storyBeat', 'dialogue'];
        const optional = ['shotId', 'sceneId', 'emotion'];
        let score = 100;
        const reasons = [];
        const checks = {};
        for (const field of required) {
            const exists = !!payload[field] && payload[field] !== '';
            checks[field] = exists;
            if (!exists) {
                score -= 40;
                reasons.push(`Missing required field: ${field}`);
            }
        }
        for (const field of optional) {
            const exists = !!payload[field];
            checks[field] = exists;
            if (exists) {
                score += 5;
            }
        }
        if (payload.storyBeat && payload.storyBeat.length < 3) {
            score -= 20;
            reasons.push('storyBeat too short');
        }
        if (payload.dialogue && payload.dialogue.length > 500) {
            score -= 10;
            reasons.push('dialogue too long');
        }
        score = Math.min(100, Math.max(0, score));
        const hash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(payload))
            .digest('hex')
            .substring(0, 16);
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/qc/narrative');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const reportPath = (0, path_1.join)(outputDir, `qc02_${hash}.json`);
        const report = {
            score,
            checks,
            reasons,
            payload_schema: Object.keys(payload),
            timestamp: new Date().toISOString(),
        };
        (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2));
        return {
            status: score >= 80 ? 'PASS' : score >= 50 ? 'WARN' : 'FAIL',
            reportUrl: `file://${reportPath}`,
            metrics: { score, reasons },
        };
    }
};
exports.QC02NarrativeConsistencyAdapter = QC02NarrativeConsistencyAdapter;
exports.QC02NarrativeConsistencyAdapter = QC02NarrativeConsistencyAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService, audit_service_1.AuditService, cost_ledger_service_1.CostLedgerService])
], QC02NarrativeConsistencyAdapter);
//# sourceMappingURL=qc02_narrative_consistency.adapter.js.map