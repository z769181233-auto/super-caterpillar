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
exports.VG04CameraPathAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const path_1 = require("path");
const fs_1 = require("fs");
const engines_vg04_1 = require("@scu/engines-vg04");
let VG04CameraPathAdapter = class VG04CameraPathAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg04_camera_path', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const shotDescription = payload.shotDescription || payload.text || 'Static shot';
        const duration = payload.duration || 5;
        const fps = payload.fps || 24;
        const result = await engines_vg04_1.vg04RealEngine.run({
            shot_description: shotDescription,
            duration,
            fps,
            pacing_score: payload.pacing_score,
            emotional_intensity: payload.emotional_intensity,
        });
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/path');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const outputPath = (0, path_1.join)(outputDir, `${hash}.json`);
        (0, fs_1.writeFileSync)(outputPath, JSON.stringify({
            mode: result.mode,
            duration: result.duration,
            fps: result.fps,
            keyframes: result.keyframes,
            ai_description: result.description,
        }, null, 2));
        return {
            assetUrl: `file://${outputPath}`,
            meta: {
                mode: result.mode,
                duration: result.duration,
                fps: result.fps,
                format: 'json',
                ai: result.audit_trail.engine_version,
            },
        };
    }
};
exports.VG04CameraPathAdapter = VG04CameraPathAdapter;
exports.VG04CameraPathAdapter = VG04CameraPathAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG04CameraPathAdapter);
//# sourceMappingURL=vg04_camera_path.adapter.js.map