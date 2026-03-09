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
exports.VG09HairPhysicsAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let VG09HairPhysicsAdapter = class VG09HairPhysicsAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg09_hair_physics', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const characterId = payload.characterId || 'char_default';
        const hairStyle = payload.hairStyle || 'long_straight';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/hair');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const physicsDataPath = (0, path_1.join)(outputDir, `${hash}_physics.json`);
        const physicsData = {
            characterId,
            hairStyle,
            simulatedFrames: 120,
            collisionHits: payload.collisionCheck ? 15 : 0,
            averageMotionVector: { x: (payload.windDirection?.x || 1) * 0.1, y: 0.05, z: 0.02 },
            timestamp: new Date().toISOString(),
        };
        (0, fs_1.writeFileSync)(physicsDataPath, JSON.stringify(physicsData, null, 2));
        const previewPath = (0, path_1.join)(outputDir, `${hash}_preview.png`);
        this.generateHairPreview(previewPath, hairStyle);
        return {
            physicsDataUrl: `file://${physicsDataPath}`,
            previewImageUrl: `file://${previewPath}`,
            meta: {
                characterId,
                hairStyle,
                engine: 'vg09-hair-phys-stub',
            },
        };
    }
    generateHairPreview(outputPath, hairStyle) {
        let color = 'brown';
        if (hairStyle.includes('blonde'))
            color = 'gold';
        if (hairStyle.includes('raven'))
            color = 'black';
        const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=256x256 -vf "drawgrid=w=10:h=10:t=1:c=white@0.3" -frames:v 1 "${outputPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (error) {
            (0, fs_1.writeFileSync)(outputPath, '');
        }
    }
};
exports.VG09HairPhysicsAdapter = VG09HairPhysicsAdapter;
exports.VG09HairPhysicsAdapter = VG09HairPhysicsAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG09HairPhysicsAdapter);
//# sourceMappingURL=vg09_hair_physics.adapter.js.map