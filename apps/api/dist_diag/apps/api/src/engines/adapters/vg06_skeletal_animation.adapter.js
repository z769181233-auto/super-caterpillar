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
exports.VG06SkeletalAnimationAdapter = void 0;
const common_1 = require("@nestjs/common");
const vg_base_engine_1 = require("../base/vg_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let VG06SkeletalAnimationAdapter = class VG06SkeletalAnimationAdapter extends vg_base_engine_1.VgBaseEngine {
    constructor(redis, audit, cost) {
        super('vg06_skeletal_animation', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const characterId = payload.characterId || 'char_default';
        const action = payload.action || 'idle';
        const duration = payload.duration || 2.0;
        const fps = payload.fps || 24;
        const style = payload.style || 'smooth';
        const layered = payload.layered || false;
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/vg/skeletal');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const animationData = this.generateSkeletalAnimation(action, duration, fps, style, layered);
        const dataPath = (0, path_1.join)(outputDir, `${hash}_anim.json`);
        (0, fs_1.writeFileSync)(dataPath, JSON.stringify(animationData, null, 2));
        const previewPath = (0, path_1.join)(outputDir, `${hash}_preview.mp4`);
        this.generateAnimationPreview(animationData, previewPath, fps);
        return {
            animationDataUrl: `file://${dataPath}`,
            previewVideoUrl: `file://${previewPath}`,
            meta: {
                characterId,
                action,
                duration,
                fps,
                frameCount: animationData.frames.length,
                boneCount: animationData.skeleton.bones.length,
                style,
                layered,
            },
        };
    }
    generateSkeletalAnimation(action, duration, fps, style, layered) {
        const frameCount = Math.floor(duration * fps);
        const skeleton = {
            bones: [
                { id: 'root', parent: null, length: 0 },
                { id: 'spine', parent: 'root', length: 80 },
                { id: 'head', parent: 'spine', length: 40 },
                { id: 'leftArm', parent: 'spine', length: 60 },
                { id: 'rightArm', parent: 'spine', length: 60 },
                { id: 'leftLeg', parent: 'root', length: 70 },
                { id: 'rightLeg', parent: 'root', length: 70 },
            ],
        };
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const t = i / frameCount;
            const frame = this.generateFrame(action, t, skeleton, style, layered);
            frames.push(frame);
        }
        return {
            version: '1.0',
            skeleton,
            action,
            duration,
            fps,
            frameCount,
            frames,
        };
    }
    generateFrame(action, t, skeleton, style, layered) {
        const frame = { time: t, bones: {} };
        const lerp = style === 'snappy' ? this.snapInterpolate : this.smoothInterpolate;
        switch (action) {
            case 'walk':
                frame.bones.leftLeg = { rotation: Math.sin(t * Math.PI * 4) * 30 };
                frame.bones.rightLeg = { rotation: Math.sin(t * Math.PI * 4 + Math.PI) * 30 };
                frame.bones.leftArm = { rotation: Math.sin(t * Math.PI * 4 + Math.PI) * 20 };
                frame.bones.rightArm = { rotation: Math.sin(t * Math.PI * 4) * 20 };
                break;
            case 'run':
                frame.bones.leftLeg = { rotation: Math.sin(t * Math.PI * 8) * 45 };
                frame.bones.rightLeg = { rotation: Math.sin(t * Math.PI * 8 + Math.PI) * 45 };
                frame.bones.leftArm = { rotation: Math.sin(t * Math.PI * 8 + Math.PI) * 35 };
                frame.bones.rightArm = { rotation: Math.sin(t * Math.PI * 8) * 35 };
                frame.bones.spine = { rotation: Math.sin(t * Math.PI * 8) * 5 };
                break;
            case 'jump': {
                const jumpPhase = t < 0.5 ? t * 2 : 2 - t * 2;
                frame.bones.leftLeg = { rotation: -45 * jumpPhase };
                frame.bones.rightLeg = { rotation: -45 * jumpPhase };
                frame.bones.leftArm = { rotation: 60 * jumpPhase };
                frame.bones.rightArm = { rotation: 60 * jumpPhase };
                frame.bones.root = { y: -50 * Math.sin(t * Math.PI) };
                break;
            }
            case 'wave':
                frame.bones.rightArm = { rotation: 90 + Math.sin(t * Math.PI * 4) * 30 };
                break;
            case 'sit':
                frame.bones.leftLeg = { rotation: 90 };
                frame.bones.rightLeg = { rotation: 90 };
                frame.bones.spine = { rotation: -10 };
                break;
            default:
                frame.bones.spine = { rotation: Math.sin(t * Math.PI) * 2 };
                break;
        }
        return frame;
    }
    smoothInterpolate(a, b, t) {
        const smoothT = t * t * (3 - 2 * t);
        return a + (b - a) * smoothT;
    }
    snapInterpolate(a, b, t) {
        return t < 0.5 ? a : b;
    }
    generateAnimationPreview(animationData, outputPath, fps) {
        const duration = animationData.duration;
        const cmd = `ffmpeg -y -f lavfi -i color=c=0x2a2a2a:s=512x512:r=${fps} -t ${duration} -pix_fmt yuv420p "${outputPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (error) {
            (0, fs_1.writeFileSync)(outputPath, '');
        }
    }
};
exports.VG06SkeletalAnimationAdapter = VG06SkeletalAnimationAdapter;
exports.VG06SkeletalAnimationAdapter = VG06SkeletalAnimationAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], VG06SkeletalAnimationAdapter);
//# sourceMappingURL=vg06_skeletal_animation.adapter.js.map