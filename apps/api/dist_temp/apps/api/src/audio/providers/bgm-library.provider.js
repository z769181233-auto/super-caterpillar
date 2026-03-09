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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BgmLibraryProvider = void 0;
const child_process_1 = require("child_process");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ffmpeg_mixer_1 = require("../mixer/ffmpeg-mixer");
const bgm_library_registry_1 = require("./bgm-library.registry");
class BgmLibraryProvider {
    key() {
        return 'deterministic_bgm_v1';
    }
    run(cmd, args) {
        return new Promise((resolve, reject) => {
            const p = (0, child_process_1.spawn)(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            p.stderr.on('data', (d) => (stderr += d.toString()));
            p.on('error', reject);
            p.on('close', (code) => {
                if (code === 0)
                    return resolve();
                reject(new Error(`ffmpeg failed code=${code}\n${stderr}`));
            });
        });
    }
    weightedPick(h, tracks) {
        const val = h.readUInt32BE(0);
        const totalWeight = tracks.reduce((sum, t) => sum + t.weight, 0);
        let threshold = val % totalWeight;
        for (const t of tracks) {
            threshold -= t.weight;
            if (threshold < 0)
                return t;
        }
        return tracks[0];
    }
    async synthesize(input) {
        const seed = input.seed || input.text;
        const h = crypto.createHash('sha256').update(seed, 'utf8').digest();
        const requestedId = input.libraryId || bgm_library_registry_1.DEFAULT_BGM_LIBRARY_ID;
        const libraryId = bgm_library_registry_1.BGM_LIBRARIES[requestedId] ? requestedId : bgm_library_registry_1.DEFAULT_BGM_LIBRARY_ID;
        const libraryIdSource = !input.libraryId
            ? 'default'
            : bgm_library_registry_1.BGM_LIBRARIES[input.libraryId]
                ? 'project'
                : 'fallback';
        const library = bgm_library_registry_1.BGM_LIBRARIES[libraryId];
        const track = this.weightedPick(h, library.tracks);
        const durationSec = input.preview ? 5.0 : 30.0;
        const outDir = path.join(process.cwd(), 'tmp', 'audio_bgm');
        fs.mkdirSync(outDir, { recursive: true });
        const cacheObj = {
            seed,
            libraryId,
            libraryVersion: library.version,
            trackId: track.id,
            preview: !!input.preview,
            durationSec,
        };
        const cacheKey = crypto
            .createHash('sha256')
            .update(JSON.stringify(cacheObj))
            .digest('hex')
            .slice(0, 16);
        const outPath = path.join(outDir, `bgm_lib_${cacheKey}.wav`);
        const lavfi = `sine=f=${track.baseFreq}:d=${durationSec},aecho=0.8:0.88:60:0.4,tremolo=f=${track.pulseFreq}:d=0.5`;
        const args = [
            '-y',
            '-f',
            'lavfi',
            '-i',
            lavfi,
            '-ar',
            '48000',
            '-ac',
            '2',
            '-c:a',
            'pcm_s16le',
            '-flags',
            '+bitexact',
            outPath,
        ];
        if (fs.existsSync(outPath)) {
            console.log(`[CACHE] Hit: ${outPath}`);
        }
        else {
            await this.run('ffmpeg', args);
        }
        const fileSha = (0, ffmpeg_mixer_1.sha256File)(outPath);
        return {
            absPath: outPath,
            container: 'wav',
            meta: {
                provider: this.key(),
                algoVersion: 'bgm_library_v1.0.0',
                durationMs: durationSec * 1000,
                audioFileSha256: fileSha,
                killSwitch: false,
                killSwitchSource: 'none',
                model: libraryId,
                vendor: 'internal_library',
                bgmTrackId: track.id,
                bgmLibraryVersion: library.version,
                bgmSelectionSeed: seed,
                libraryId,
                libraryIdSource: libraryIdSource,
            },
        };
    }
}
exports.BgmLibraryProvider = BgmLibraryProvider;
//# sourceMappingURL=bgm-library.provider.js.map