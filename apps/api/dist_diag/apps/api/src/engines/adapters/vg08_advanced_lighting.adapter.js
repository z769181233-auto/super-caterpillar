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
exports.VG08AdvancedLightingAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let VG08AdvancedLightingAdapter = class VG08AdvancedLightingAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg08_advanced_lighting', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const sceneId = payload.sceneId || 'scene_default';
        const quality = payload.quality || 'production';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/lighting');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const lightMapPath = (0, path_1.join)(outputDir, `${hash}_lightmap.json`);
        const lightMap = {
            sceneId,
            quality,
            timestamp: new Date().toISOString(),
            lights: payload.lightSources || [],
            globalIllumination: quality === 'ultra' ? 0.8 : 0.5,
            ambientOcclusion: true,
            rayDepth: payload.rayDepth || 2,
        };
        (0, fs_1.writeFileSync)(lightMapPath, JSON.stringify(lightMap, null, 2));
        const previewPath = (0, path_1.join)(outputDir, `${hash}_preview.png`);
        this.generateLightingPreview(previewPath, payload.lightSources);
        return {
            lightMapUrl: `file://${lightMapPath}`,
            previewImageUrl: `file://${previewPath}`,
            meta: {
                sceneId,
                quality,
                rayDepth: lightMap.rayDepth,
                engine: 'vg08-raytracer-stub',
            },
        };
    }
    generateLightingPreview(outputPath, lights) {
        const lightCount = (lights || []).length;
        const brightness = Math.min(lightCount * 20 + 40, 100);
        const cmd = `ffmpeg -y -f lavfi -i color=c=white:s=256x256 -vf "drawbox=x=0:y=0:w=256:h=256:color=black@${1 - brightness / 100}:t=fill" -frames:v 1 "${outputPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (error) {
            (0, fs_1.writeFileSync)(outputPath, '');
        }
    }
};
exports.VG08AdvancedLightingAdapter = VG08AdvancedLightingAdapter;
exports.VG08AdvancedLightingAdapter = VG08AdvancedLightingAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG08AdvancedLightingAdapter);
//# sourceMappingURL=vg08_advanced_lighting.adapter.js.map