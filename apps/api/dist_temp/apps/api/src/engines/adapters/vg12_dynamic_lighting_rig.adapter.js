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
exports.VG12DynamicLightingRigAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let VG12DynamicLightingRigAdapter = class VG12DynamicLightingRigAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg12_dynamic_lighting_rig', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const sceneId = payload.sceneId || 'scene_default';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/lighting_rig');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const rigPath = (0, path_1.join)(outputDir, `${hash}_rig.json`);
        const rig = {
            sceneId,
            mood: payload.mood || 'cinematic',
            lights: Array.from({ length: payload.lightCount || 5 }).map((_, i) => ({
                id: `light_${i}`,
                type: 'spot',
                transform: { pos: { x: i * 2, y: 10, z: i * -5 }, rot: { x: -45, y: 0, z: 0 } },
                animation: 'pulse',
            })),
            timestamp: new Date().toISOString(),
        };
        (0, fs_1.writeFileSync)(rigPath, JSON.stringify(rig, null, 2));
        const previewPath = (0, path_1.join)(outputDir, `${hash}_rig_preview.png`);
        this.generateRigPreview(previewPath, payload.mood);
        return {
            rigDataUrl: `file://${rigPath}`,
            previewImageUrl: `file://${previewPath}`,
            meta: {
                sceneId,
                mood: rig.mood,
                engine: 'vg12-lighting-rig-stub',
            },
        };
    }
    generateRigPreview(outputPath, mood) {
        let color = 'gold';
        if (mood === 'horror')
            color = 'darkblue';
        if (mood === 'hope')
            color = 'lightblue';
        const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=512x256 -vf "drawgrid=w=50:h=50:t=2:c=yellow@0.5" -frames:v 1 "${outputPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (error) {
            (0, fs_1.writeFileSync)(outputPath, '');
        }
    }
};
exports.VG12DynamicLightingRigAdapter = VG12DynamicLightingRigAdapter;
exports.VG12DynamicLightingRigAdapter = VG12DynamicLightingRigAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG12DynamicLightingRigAdapter);
//# sourceMappingURL=vg12_dynamic_lighting_rig.adapter.js.map