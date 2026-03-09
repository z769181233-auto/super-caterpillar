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
exports.sha256File = sha256File;
exports.mixWithDucking = mixWithDucking;
const child_process_1 = require("child_process");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
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
async function mixWithDucking(input) {
    const fadeMs = input.fadeMs ?? 500;
    const durSec = input.durationMs ? input.durationMs / 1000 : 0;
    const filter = [
        `[1:a][0:a]sidechaincompress=threshold=0.08:ratio=15:attack=0.1:release=1.2[bgm_ducked]`,
        `[0:a][bgm_ducked]amix=inputs=2:duration=first:normalize=0[mixed]`,
        `[mixed]afade=t=in:d=${fadeMs / 1000}${durSec > 1 ? `,afade=t=out:d=${fadeMs / 1000}:st=${(durSec - fadeMs / 1000).toFixed(3)}` : ''}[outa]`,
    ].join(';');
    const args = [
        '-y',
        '-i',
        input.voiceWavPath,
        '-stream_loop',
        '-1',
        '-i',
        input.bgmWavPath,
        '-filter_complex',
        filter,
        '-map',
        '[outa]',
        '-c:a',
        'pcm_s16le',
        '-ar',
        '48000',
        '-threads',
        '1',
        '-fflags',
        '+bitexact',
        '-flags',
        '+bitexact',
        '-map_metadata',
        '-1',
    ];
    if (durSec > 0) {
        args.push('-t', durSec.toFixed(3));
    }
    args.push(input.outWavPath);
    await run('ffmpeg', args);
    return { outSha256: sha256File(input.outWavPath) };
}
//# sourceMappingURL=ffmpeg-mixer.js.map