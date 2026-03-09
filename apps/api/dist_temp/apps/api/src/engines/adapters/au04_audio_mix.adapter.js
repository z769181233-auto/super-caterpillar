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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AU04AudioMixAdapter = void 0;
const common_1 = require("@nestjs/common");
const au_base_engine_1 = require("../base/au_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let AU04AudioMixAdapter = class AU04AudioMixAdapter extends au_base_engine_1.AuBaseEngine {
    constructor(redis, audit, cost) {
        super('au04_audio_mix', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const tracks = payload.tracks || [];
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/au/mix');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const outputPath = (0, path_1.join)(outputDir, `${hash}.wav`);
        let inputs = '';
        let count = 0;
        for (const t of tracks) {
            const p = t.url.replace('file://', '');
            if ((0, fs_1.existsSync)(p)) {
                inputs += `-i "${p}" `;
                count++;
            }
        }
        if (count === 0) {
            inputs = '-f lavfi -i "sine=f=440:d=1"';
            count = 1;
        }
        const cmd = `ffmpeg -y ${inputs} -filter_complex amix=inputs=${count} "${outputPath}"`;
        (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        return {
            assetUrl: `file://${outputPath}`,
            meta: { tracks_count: count, format: 'wav' },
        };
    }
};
exports.AU04AudioMixAdapter = AU04AudioMixAdapter;
exports.AU04AudioMixAdapter = AU04AudioMixAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], AU04AudioMixAdapter);
//# sourceMappingURL=au04_audio_mix.adapter.js.map