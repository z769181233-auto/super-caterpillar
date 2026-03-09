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
exports.QC04ComplianceScanAdapter = void 0;
const common_1 = require("@nestjs/common");
const qc_base_engine_1 = require("../base/qc_base.engine");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
let QC04ComplianceScanAdapter = class QC04ComplianceScanAdapter extends qc_base_engine_1.QcBaseEngine {
    constructor(redis, audit, cost) {
        super('qc04_compliance_scan', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload || {});
    }
    async processLogic(payload, input) {
        const text = JSON.stringify(payload);
        const sensitiveWords = ['password', 'secret', 'admin', 'hack', 'exploit'];
        const warningWords = ['test', 'debug', 'temp'];
        const bannedPatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/,
            /\b[A-Z]\d{5}\b/,
        ];
        const violations = [];
        const warnings = [];
        for (const word of sensitiveWords) {
            if (text.toLowerCase().includes(word)) {
                violations.push(`Sensitive keyword: ${word}`);
            }
        }
        for (const word of warningWords) {
            if (text.toLowerCase().includes(word)) {
                warnings.push(`Warning keyword: ${word}`);
            }
        }
        for (const pattern of bannedPatterns) {
            if (pattern.test(text)) {
                violations.push(`Banned pattern matched: ${pattern.source}`);
            }
        }
        const status = violations.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';
        const hash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(payload))
            .digest('hex')
            .substring(0, 16);
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/qc/compliance');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const reportPath = (0, path_1.join)(outputDir, `qc04_${hash}.json`);
        const report = {
            scanResults: {
                violations,
                warnings,
                policy: 'V1.1_Standard',
                isSafe: violations.length === 0,
                verdict: status,
            },
            timestamp: new Date().toISOString(),
        };
        (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2));
        return {
            status,
            reportUrl: `file://${reportPath}`,
            metrics: { violations: violations.length, warnings: warnings.length },
        };
    }
};
exports.QC04ComplianceScanAdapter = QC04ComplianceScanAdapter;
exports.QC04ComplianceScanAdapter = QC04ComplianceScanAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService, audit_service_1.AuditService, cost_ledger_service_1.CostLedgerService])
], QC04ComplianceScanAdapter);
//# sourceMappingURL=qc04_compliance_scan.adapter.js.map