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
var AudioTTSLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioTTSLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const os_exec_1 = require("../../../../../packages/shared/os_exec");
const fs_safe_1 = require("../../../../../packages/shared/fs_safe");
const hash_1 = require("../../../../../packages/shared/hash");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const perf_hooks_1 = require("perf_hooks");
let AudioTTSLocalAdapter = AudioTTSLocalAdapter_1 = class AudioTTSLocalAdapter {
    name = 'audio_tts';
    logger = new common_1.Logger(AudioTTSLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'audio_tts';
    }
    async invoke(input) {
        const { text, voice } = input.payload;
        const traceId = input.context?.traceId || `tts_${Date.now()}`;
        const t0 = perf_hooks_1.performance.now();
        try {
            const storageRoot = process.env.STORAGE_ROOT || '.runtime';
            const outRelative = `audio/tts_${traceId}.wav`;
            const outPath = (0, fs_safe_1.safeJoin)(storageRoot, outRelative);
            const tmpAiff = outPath + '.aiff';
            await fs_1.promises.mkdir(path.dirname(outPath), { recursive: true });
            if (process.platform !== 'darwin') {
                throw new Error('TTS_BACKEND_UNAVAILABLE: "say" command only available on macOS.');
            }
            const sayArgs = [];
            if (voice)
                sayArgs.push('-v', voice);
            sayArgs.push('-o', tmpAiff, '--', text);
            this.logger.log(`[TTS_ASYNC] Executing: say ${sayArgs.join(' ')}`);
            const sayRes = await (0, os_exec_1.execAsync)('say', sayArgs);
            if (sayRes.code !== 0) {
                throw new Error(`TTS_EXEC_FAIL: say failed (code ${sayRes.code}): ${sayRes.stderr}`);
            }
            const ffmpegArgs = ['-y', '-i', tmpAiff, '-ar', '44100', '-ac', '1', outPath];
            const ffmpegRes = await (0, os_exec_1.execAsync)('ffmpeg', ffmpegArgs);
            if (await fs_1.promises
                .access(tmpAiff)
                .then(() => true)
                .catch(() => false)) {
                await fs_1.promises.unlink(tmpAiff);
            }
            if (ffmpegRes.code !== 0) {
                throw new Error(`TTS_CONVERT_FAIL: ffmpeg failed (code ${ffmpegRes.code}): ${ffmpegRes.stderr}`);
            }
            const stat = await fs_1.promises.stat(outPath);
            if (stat.size < 100)
                throw new Error('TTS_OUTPUT_EMPTY: Result file too small');
            const probeRes = await (0, os_exec_1.execAsync)('ffprobe', [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                outPath,
            ]);
            const duration = parseFloat(probeRes.stdout.trim());
            if (isNaN(duration) || duration < 0.1)
                throw new Error(`TTS_DURATION_INVALID: ${duration}s`);
            const hash = await (0, hash_1.sha256File)(outPath);
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: {
                    storageKey: outRelative,
                    duration,
                    sha256: hash,
                    size: stat.size,
                    provider: 'macos-say-v1-async',
                },
                metrics: {
                    durationMs: Math.round(perf_hooks_1.performance.now() - t0),
                },
            };
        }
        catch (error) {
            this.logger.error(`[AUDIO_TTS_FAIL] ${error.message}`);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: {
                    code: 'AUDIO_TTS_FAIL',
                    message: error.message,
                },
            };
        }
    }
};
exports.AudioTTSLocalAdapter = AudioTTSLocalAdapter;
exports.AudioTTSLocalAdapter = AudioTTSLocalAdapter = AudioTTSLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], AudioTTSLocalAdapter);
//# sourceMappingURL=audio-tts.local.adapter.js.map