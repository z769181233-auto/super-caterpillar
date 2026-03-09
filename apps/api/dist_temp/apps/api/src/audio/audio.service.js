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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const common_1 = require("@nestjs/common");
const stub_wav_provider_1 = require("./providers/stub-wav.provider");
const real_tts_provider_1 = require("./providers/real-tts.provider");
const bgm_library_provider_1 = require("./providers/bgm-library.provider");
const ffmpeg_mixer_1 = require("./mixer/ffmpeg-mixer");
const ops_metrics_service_1 = require("../ops/ops-metrics.service");
let AudioService = class AudioService {
    metrics;
    stubProvider;
    realProvider;
    bgmProvider;
    constructor(metrics) {
        this.metrics = metrics;
        this.stubProvider = new stub_wav_provider_1.StubWavProvider();
        this.realProvider = new real_tts_provider_1.RealTtsProvider();
        this.bgmProvider = new bgm_library_provider_1.BgmLibraryProvider();
    }
    async resolveProjectSettings(prisma, projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { settingsJson: true },
        });
        if (!project || !project.settingsJson)
            return {};
        const s = project.settingsJson;
        return {
            audioRealEnabled: s.audioRealEnabled === true || s.audioRealEnabled === 'true',
            audioBgmEnabled: s.audioBgmEnabled === true || s.audioBgmEnabled === 'true',
            audioMixerEnabled: s.audioMixerEnabled !== false && s.audioMixerEnabled !== 'false',
            audioBgmLibraryId: s.audioBgmLibraryId || undefined,
        };
    }
    isKillSwitchOn() {
        return process.env.AUDIO_REAL_FORCE_DISABLE === '1';
    }
    async generateAndMix(req) {
        const project = req.projectSettings ?? {};
        const killOn = this.isKillSwitchOn();
        if (req.preview)
            this.metrics.incrementAudioPreview();
        if (killOn) {
            const voice = await this.stubProvider.synthesize({ text: req.text });
            const signals = {
                audio_kill_switch: true,
                audio_kill_switch_source: 'env',
                audio_mode: 'legacy',
                provider: voice.meta.provider,
                algo_version: voice.meta.algoVersion,
                duration_ms: voice.meta.durationMs,
                audio_file_sha256: voice.meta.audioFileSha256,
                audio_preview: !!req.preview,
                preview_cap_ms: req.preview ? req.previewCapMs || 3000 : 0,
                voice_meta: voice.meta,
                audio_real_enabled: project.audioRealEnabled,
            };
            return { voice, signals };
        }
        const provider = project.audioRealEnabled ? this.realProvider : this.stubProvider;
        if (project.audioRealEnabled && !killOn) {
            this.metrics.incrementAudioVendorCall();
        }
        const voice = await provider.synthesize({
            text: req.text,
            preview: req.preview,
        });
        const signals = {
            audio_kill_switch: false,
            audio_kill_switch_source: 'none',
            audio_mode: project.audioRealEnabled ? 'real' : 'stub',
            provider: voice.meta.provider,
            algo_version: voice.meta.algoVersion,
            duration_ms: voice.meta.durationMs,
            audio_file_sha256: voice.meta.audioFileSha256,
            audio_preview: !!req.preview,
            preview_cap_ms: req.preview ? req.previewCapMs || 3000 : 0,
            voice_meta: voice.meta,
            audio_real_enabled: project.audioRealEnabled,
        };
        const mixerEnabled = project.audioMixerEnabled ?? true;
        if (!mixerEnabled) {
            return { voice, signals };
        }
        if (!project.audioBgmEnabled) {
            return { voice, signals };
        }
        const bgmSeed = req.bgmSeed ?? req.text;
        const libOverride = process.env.AUDIO_BGM_LIBRARY_ID_OVERRIDE;
        const libRequested = libOverride || project.audioBgmLibraryId || 'bgm_lib_v1';
        const bgm = await this.bgmProvider.synthesize({
            text: bgmSeed,
            seed: bgmSeed,
            libraryId: libRequested,
            preview: req.preview,
        });
        signals.bgm_library_requested = libRequested;
        const outDir = path.join(process.cwd(), 'tmp', 'audio_mix');
        fs.mkdirSync(outDir, { recursive: true });
        const mixCacheObj = {
            voiceSha: voice.meta.audioFileSha256,
            bgmSha: bgm.meta.audioFileSha256,
            voiceDur: voice.meta.durationMs,
            mixer: 'ffmpeg_mix_v1',
            preview: !!req.preview,
            previewCapMs: req.preview ? req.previewCapMs || 3000 : 0,
        };
        const mixKey = crypto
            .createHash('sha256')
            .update(JSON.stringify(mixCacheObj))
            .digest('hex')
            .slice(0, 16);
        const outPath = path.join(outDir, `mix_${mixKey}.wav`);
        if (fs.existsSync(outPath)) {
            console.log(`[CACHE] Mix Hit: ${outPath}`);
            this.metrics.incrementAudioCacheHit();
        }
        else {
            this.metrics.incrementAudioCacheMiss();
            await (0, ffmpeg_mixer_1.mixWithDucking)({
                voiceWavPath: voice.absPath,
                bgmWavPath: bgm.absPath,
                outWavPath: outPath,
                durationMs: voice.meta.durationMs,
            });
        }
        const mixedSha = (0, ffmpeg_mixer_1.sha256File)(outPath);
        signals.mixer = 'ffmpeg_mix_v1';
        signals.mixed_audio_sha256 = mixedSha;
        signals.bgm_provider = bgm.meta.provider;
        signals.bgm_sha256 = bgm.meta.audioFileSha256;
        signals.bgm_track_id = bgm.meta.bgmTrackId;
        signals.bgm_library_version = bgm.meta.bgmLibraryVersion;
        signals.bgm_selection_seed = bgm.meta.bgmSelectionSeed;
        signals.bgm_library_id = bgm.meta.libraryId;
        signals.bgm_library_id_source = bgm.meta.libraryIdSource;
        signals.bgm_library_id_requested = libRequested;
        signals.mixer_params = {
            gain: 1.0,
            ducking: {
                algo: 'sidechaincompress_v1',
                threshold: 0.08,
                ratio: 15,
                attack: 0.1,
                release: 1.2,
            },
            fade: {
                algo: 'afade_v1',
                duration_ms: 500,
            },
        };
        return {
            voice,
            mixed: { absPath: outPath, sha256: mixedSha },
            signals,
            bgm,
        };
    }
    async generateBgm(req) {
        const project = req.projectSettings ?? {};
        const bgmSeed = req.bgmSeed ?? req.text;
        const libOverride = process.env.AUDIO_BGM_LIBRARY_ID_OVERRIDE;
        const libRequested = libOverride || project.audioBgmLibraryId || 'bgm_lib_v1';
        return this.bgmProvider.synthesize({
            text: bgmSeed,
            seed: bgmSeed,
            libraryId: libRequested,
            preview: req.preview,
        });
    }
};
exports.AudioService = AudioService;
exports.AudioService = AudioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ops_metrics_service_1.OpsMetricsService])
], AudioService);
//# sourceMappingURL=audio.service.js.map