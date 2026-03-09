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
exports.VG11ParticleEffectsAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let VG11ParticleEffectsAdapter = class VG11ParticleEffectsAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg11_particle_effects', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const effectType = payload.effectType || 'fire';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/vfx');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const systemPath = (0, path_1.join)(outputDir, `${hash}_system.json`);
        const system = {
            effectType,
            lifetime: payload.duration || 5.0,
            bornCount: payload.particleCount || 1000,
            emitter: 'point',
            gravity: effectType === 'fire' ? -1.0 : 0.5,
            timestamp: new Date().toISOString(),
        };
        (0, fs_1.writeFileSync)(systemPath, JSON.stringify(system, null, 2));
        const previewPath = (0, path_1.join)(outputDir, `${hash}_preview.png`);
        this.generateParticlePreview(previewPath, effectType);
        return {
            vfxSystemUrl: `file://${systemPath}`,
            previewImageUrl: `file://${previewPath}`,
            meta: {
                effectType,
                engine: 'vg11-particle-vfx-stub',
            },
        };
    }
    generateParticlePreview(outputPath, effectType) {
        let color = 'orange';
        if (effectType === 'smoke')
            color = 'gray';
        if (effectType === 'spark')
            color = 'white';
        if (effectType === 'magic')
            color = 'purple';
        const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=256x256 -vf "noise=alls=50:allf=t+p" -frames:v 1 "${outputPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (error) {
            (0, fs_1.writeFileSync)(outputPath, '');
        }
    }
};
exports.VG11ParticleEffectsAdapter = VG11ParticleEffectsAdapter;
exports.VG11ParticleEffectsAdapter = VG11ParticleEffectsAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG11ParticleEffectsAdapter);
//# sourceMappingURL=vg11_particle_effects.adapter.js.map