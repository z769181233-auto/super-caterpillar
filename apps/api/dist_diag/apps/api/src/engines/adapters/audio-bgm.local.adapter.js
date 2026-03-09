"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var AudioBGMLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioBGMLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const os_exec_1 = require("../../../../../packages/shared/os_exec");
const fs_safe_1 = require("../../../../../packages/shared/fs_safe");
const hash_1 = require("../../../../../packages/shared/hash");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const perf_hooks_1 = require("perf_hooks");
let AudioBGMLocalAdapter = AudioBGMLocalAdapter_1 = class AudioBGMLocalAdapter {
    name = 'audio_bgm';
    logger = new common_1.Logger(AudioBGMLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'audio_bgm';
    }
    async invoke(input) {
        const { sourceKey, targetDuration } = input.payload;
        const traceId = input.context?.traceId || `bgm_${Date.now()}`;
        const t0 = perf_hooks_1.performance.now();
        try {
            const storageRoot = process.env.STORAGE_ROOT || '.runtime';
            const sourcePath = (0, fs_safe_1.safeJoin)(storageRoot, sourceKey);
            const outRelative = `audio/bgm_mix_${traceId}.wav`;
            const outPath = (0, fs_safe_1.safeJoin)(storageRoot, outRelative);
            await fs_1.promises.mkdir(path.dirname(outPath), { recursive: true });
            if (!(await fs_1.promises
                .access(sourcePath)
                .then(() => true)
                .catch(() => false))) {
                throw new Error(`BGM_SOURCE_NOT_FOUND: ${sourceKey}`);
            }
            const args = [
                '-y',
                '-stream_loop',
                '-1',
                '-i',
                sourcePath,
                '-t',
                String(targetDuration),
                '-ar',
                '44100',
                '-ac',
                '2',
                outPath,
            ];
            this.logger.log(`[BGM_ASYNC] Executing: ffmpeg ${args.join(' ')}`);
            const res = await (0, os_exec_1.execAsync)('ffmpeg', args);
            if (res.code !== 0) {
                throw new Error(`BGM_EXEC_FAIL: ffmpeg failed (code ${res.code}): ${res.stderr}`);
            }
            const probeRes = await (0, os_exec_1.execAsync)('ffprobe', [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                outPath,
            ]);
            const actualDuration = parseFloat(probeRes.stdout.trim());
            if (Math.abs(actualDuration - targetDuration) > 0.1) {
                throw new Error(`BGM_DURATION_DRIFT: Target ${targetDuration}s, Got ${actualDuration}s`);
            }
            const hash = await (0, hash_1.sha256File)(outPath);
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: {
                    storageKey: outRelative,
                    duration: actualDuration,
                    sha256: hash,
                    provider: 'ffmpeg-loop-v1-async',
                },
                metrics: {
                    durationMs: Math.round(perf_hooks_1.performance.now() - t0),
                },
            };
        }
        catch (error) {
            this.logger.error(`[AUDIO_BGM_FAIL] ${error.message}`);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: { code: 'AUDIO_BGM_FAIL', message: error.message },
            };
        }
    }
};
exports.AudioBGMLocalAdapter = AudioBGMLocalAdapter;
exports.AudioBGMLocalAdapter = AudioBGMLocalAdapter = AudioBGMLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], AudioBGMLocalAdapter);
//# sourceMappingURL=audio-bgm.local.adapter.js.map