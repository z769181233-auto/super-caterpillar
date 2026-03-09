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
exports.DeterministicBgmProvider = void 0;
const child_process_1 = require("child_process");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ffmpeg_mixer_1 = require("../mixer/ffmpeg-mixer");
class DeterministicBgmProvider {
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
    async synthesize(input) {
        const seed = input.seed || input.text;
        const h = crypto.createHash('sha256').update(seed, 'utf8').digest();
        const baseFreq = 110 + (h[0] % 220);
        const pulseFreq = 1 + (h[1] % 5);
        const durationSec = 30.0;
        const outDir = path.join(process.cwd(), 'tmp', 'audio_bgm');
        fs.mkdirSync(outDir, { recursive: true });
        const base = crypto.createHash('sha256').update(`${seed}|BGM`).digest('hex').slice(0, 16);
        const outPath = path.join(outDir, `bgm_${base}.wav`);
        const lavfi = `sine=f=${baseFreq}:d=${durationSec},aecho=0.8:0.88:60:0.4`;
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
        await this.run('ffmpeg', args);
        const fileSha = (0, ffmpeg_mixer_1.sha256File)(outPath);
        return {
            absPath: outPath,
            container: 'wav',
            meta: {
                provider: this.key(),
                algoVersion: 'bgm_v1_deterministic',
                durationMs: durationSec * 1000,
                audioFileSha256: fileSha,
                killSwitch: false,
                killSwitchSource: 'none',
                model: `bgm_${baseFreq}hz_${pulseFreq}bpm`,
            },
        };
    }
}
exports.DeterministicBgmProvider = DeterministicBgmProvider;
//# sourceMappingURL=bgm-deterministic.provider.js.map