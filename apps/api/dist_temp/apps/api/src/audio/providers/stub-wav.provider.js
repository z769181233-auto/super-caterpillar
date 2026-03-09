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
exports.StubWavProvider = void 0;
const child_process_1 = require("child_process");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function run(cmd, args) {
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
function sha256File(absPath) {
    const buf = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(buf).digest('hex');
}
function deriveParams(text) {
    const h = crypto.createHash('sha256').update(text, 'utf8').digest();
    const u16 = (h[0] << 8) | h[1];
    const u16b = (h[2] << 8) | h[3];
    const freq = 220 + (u16 % 661);
    const durMs = 800 + (u16b % 9201);
    return { freq, durMs };
}
class StubWavProvider {
    key() {
        return 'stub_wav_v1';
    }
    async synthesize(input) {
        const text = input.text ?? '';
        const sampleRate = input.sampleRate ?? 48000;
        const channels = input.channels ?? 2;
        const { freq, durMs } = deriveParams(input.seed ?? text);
        let durationSec = durMs / 1000;
        if (input.preview) {
            durationSec = Math.min(durationSec, 3.0);
        }
        const durationSecStr = durationSec.toFixed(3);
        const outDir = path.join(process.cwd(), 'tmp', 'audio_stub');
        fs.mkdirSync(outDir, { recursive: true });
        const cacheObj = {
            seed: input.seed || text,
            freq,
            durationSec: parseFloat(durationSecStr),
            sampleRate,
            channels,
            preview: !!input.preview,
        };
        const cacheKey = crypto
            .createHash('sha256')
            .update(JSON.stringify(cacheObj))
            .digest('hex')
            .slice(0, 16);
        const outPath = path.join(outDir, `stub_${cacheKey}.wav`);
        const args = [
            '-y',
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${freq}:duration=${durationSecStr}`,
            '-ac',
            String(channels),
            '-ar',
            String(sampleRate),
            '-c:a',
            'pcm_s16le',
            '-flags',
            '+bitexact',
            '-map_metadata',
            '-1',
            outPath,
        ];
        if (fs.existsSync(outPath)) {
        }
        else {
            await run('ffmpeg', args);
        }
        const fileSha = sha256File(outPath);
        return {
            absPath: outPath,
            container: 'wav',
            meta: {
                provider: 'stub_wav_v1',
                algoVersion: 'stub_wav_v1',
                durationMs: Math.round(durationSec * 1000),
                audioFileSha256: fileSha,
                killSwitch: false,
                killSwitchSource: 'none',
            },
        };
    }
}
exports.StubWavProvider = StubWavProvider;
//# sourceMappingURL=stub-wav.provider.js.map