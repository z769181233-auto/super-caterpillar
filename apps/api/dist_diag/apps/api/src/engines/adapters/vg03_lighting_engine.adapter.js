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
exports.VG03LightingEngineAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const engines_vg03_1 = require("@scu/engines-vg03");
let VG03LightingEngineAdapter = class VG03LightingEngineAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg03_lighting_engine', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const sourceUrl = payload.sourceUrl || '';
        const moodDescription = payload.moodDescription || payload.text || 'Neutral lighting';
        const result = await engines_vg03_1.vg03RealEngine.run({
            mood_description: moodDescription,
            lighting_preset: payload.lightingPreset,
        });
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/lighting');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const outputPath = (0, path_1.join)(outputDir, `${hash}.png`);
        const sourcePath = sourceUrl.replace('file://', '');
        let inputArg = '';
        if (!sourcePath || !(0, fs_1.existsSync)(sourcePath)) {
            inputArg = `-f lavfi -i color=c=gray:s=512x512`;
        }
        else {
            inputArg = `-i "${sourcePath}"`;
        }
        const filter = result.filter_string || 'null';
        const cmd = `ffmpeg -y ${inputArg} -vf "${filter}" -frames:v 1 "${outputPath}"`;
        (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        return {
            assetUrl: `file://${outputPath}`,
            meta: {
                preset: result.preset,
                sourceUrl,
                format: 'png',
                ai: result.audit_trail.engine_version,
                parameters: result.parameters,
            },
        };
    }
};
exports.VG03LightingEngineAdapter = VG03LightingEngineAdapter;
exports.VG03LightingEngineAdapter = VG03LightingEngineAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG03LightingEngineAdapter);
//# sourceMappingURL=vg03_lighting_engine.adapter.js.map