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
exports.VG07FacialExpressionAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let VG07FacialExpressionAdapter = class VG07FacialExpressionAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg07_facial_expression', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const characterId = payload.characterId || 'char_default';
        const emotion = payload.emotion || 'neutral';
        const intensity = Math.min(Math.max(payload.intensity || 1.0, 0), 1);
        const duration = payload.duration || 1.0;
        const fps = payload.fps || 24;
        const transition = payload.transition || 'smooth';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/facial');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const expressionData = this.generateFacialExpression(emotion, intensity, duration, fps, transition);
        const dataPath = (0, path_1.join)(outputDir, `${hash}_expr.json`);
        (0, fs_1.writeFileSync)(dataPath, JSON.stringify(expressionData, null, 2));
        const previewPath = (0, path_1.join)(outputDir, `${hash}_preview.png`);
        this.generateExpressionPreview(expressionData, previewPath, emotion);
        return {
            expressionDataUrl: `file://${dataPath}`,
            previewImageUrl: `file://${previewPath}`,
            meta: {
                characterId,
                emotion,
                intensity,
                duration,
                fps,
                frameCount: expressionData.frames.length,
                keypointCount: expressionData.keypoints.length,
                transition,
            },
        };
    }
    generateFacialExpression(emotion, intensity, duration, fps, transition) {
        const frameCount = Math.floor(duration * fps);
        const keypoints = [
            { id: 'leftEyebrow', type: 'curve' },
            { id: 'rightEyebrow', type: 'curve' },
            { id: 'leftEye', type: 'aperture' },
            { id: 'rightEye', type: 'aperture' },
            { id: 'mouth', type: 'curve' },
            { id: 'cheeks', type: 'position' },
        ];
        const baseExpression = this.getBaseExpression(emotion);
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const t = i / Math.max(frameCount - 1, 1);
            const easedT = this.applyTransition(t, transition);
            const frame = this.interpolateExpression(baseExpression, easedT, intensity);
            frames.push({ time: t, keypoints: frame });
        }
        return {
            version: '1.0',
            keypoints,
            emotion,
            intensity,
            duration,
            fps,
            frameCount,
            frames,
        };
    }
    getBaseExpression(emotion) {
        const expressions = {
            happy: {
                leftEyebrow: { y: 0, curve: 0.3 },
                rightEyebrow: { y: 0, curve: 0.3 },
                leftEye: { aperture: 0.8, squint: 0.3 },
                rightEye: { aperture: 0.8, squint: 0.3 },
                mouth: { corners: 1.0, openness: 0.2, curve: 0.8 },
                cheeks: { raise: 0.5 },
            },
            sad: {
                leftEyebrow: { y: -0.3, curve: -0.5 },
                rightEyebrow: { y: -0.3, curve: -0.5 },
                leftEye: { aperture: 0.6, squint: 0 },
                rightEye: { aperture: 0.6, squint: 0 },
                mouth: { corners: -0.5, openness: 0, curve: -0.3 },
                cheeks: { raise: -0.2 },
            },
            angry: {
                leftEyebrow: { y: -0.5, curve: -0.8 },
                rightEyebrow: { y: -0.5, curve: -0.8 },
                leftEye: { aperture: 0.9, squint: -0.4 },
                rightEye: { aperture: 0.9, squint: -0.4 },
                mouth: { corners: -0.3, openness: 0.3, curve: -0.5 },
                cheeks: { raise: -0.3 },
            },
            surprised: {
                leftEyebrow: { y: 0.6, curve: 0 },
                rightEyebrow: { y: 0.6, curve: 0 },
                leftEye: { aperture: 1.0, squint: 0 },
                rightEye: { aperture: 1.0, squint: 0 },
                mouth: { corners: 0, openness: 0.7, curve: 0 },
                cheeks: { raise: 0 },
            },
            fear: {
                leftEyebrow: { y: 0.4, curve: -0.4 },
                rightEyebrow: { y: 0.4, curve: -0.4 },
                leftEye: { aperture: 1.0, squint: 0 },
                rightEye: { aperture: 1.0, squint: 0 },
                mouth: { corners: -0.2, openness: 0.3, curve: -0.2 },
                cheeks: { raise: -0.1 },
            },
            neutral: {
                leftEyebrow: { y: 0, curve: 0 },
                rightEyebrow: { y: 0, curve: 0 },
                leftEye: { aperture: 0.7, squint: 0 },
                rightEye: { aperture: 0.7, squint: 0 },
                mouth: { corners: 0, openness: 0, curve: 0 },
                cheeks: { raise: 0 },
            },
        };
        return expressions[emotion] || expressions.neutral;
    }
    interpolateExpression(baseExpression, t, intensity) {
        const result = {};
        for (const [key, value] of Object.entries(baseExpression)) {
            result[key] = {};
            for (const [prop, val] of Object.entries(value)) {
                result[key][prop] = val * t * intensity;
            }
        }
        return result;
    }
    applyTransition(t, transition) {
        switch (transition) {
            case 'instant':
                return t < 0.1 ? 0 : 1;
            case 'elastic': {
                if (t === 0 || t === 1)
                    return t;
                const p = 0.3;
                const s = p / 4;
                return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
            }
            case 'smooth':
            default:
                return t * t * (3 - 2 * t);
        }
    }
    generateExpressionPreview(expressionData, outputPath, emotion) {
        const colors = {
            happy: 'yellow',
            sad: 'blue',
            angry: 'red',
            surprised: 'orange',
            fear: 'purple',
            neutral: 'gray',
        };
        const color = colors[emotion] || 'gray';
        const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=256x256 -frames:v 1 "${outputPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (error) {
            (0, fs_1.writeFileSync)(outputPath, '');
        }
    }
};
exports.VG07FacialExpressionAdapter = VG07FacialExpressionAdapter;
exports.VG07FacialExpressionAdapter = VG07FacialExpressionAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG07FacialExpressionAdapter);
//# sourceMappingURL=vg07_facial_expression.adapter.js.map