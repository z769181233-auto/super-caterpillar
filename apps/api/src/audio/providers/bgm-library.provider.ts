
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AudioProvider, AudioSynthesisInput, AudioSynthesisOutput } from './audio-provider.interface';
import { sha256File } from '../mixer/ffmpeg-mixer';

import { BGM_LIBRARIES, DEFAULT_BGM_LIBRARY_ID } from './bgm-library.registry';

/**
 * P18-6.0: BGM Library Provider (Contract-driven)
 */
export class BgmLibraryProvider implements AudioProvider {
    key(): 'deterministic_bgm_v1' {
        return 'deterministic_bgm_v1';
    }

    private run(cmd: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            p.stderr.on('data', (d) => (stderr += d.toString()));
            p.on('error', reject);
            p.on('close', (code) => {
                if (code === 0) return resolve();
                reject(new Error(`ffmpeg failed code=${code}\n${stderr}`));
            });
        });
    }

    private weightedPick(h: Buffer, tracks: any[]) {
        // Use h[0..3] as uint32
        const val = h.readUInt32BE(0);
        const totalWeight = tracks.reduce((sum: number, t: any) => sum + t.weight, 0);
        let threshold = val % totalWeight;

        for (const t of tracks) {
            threshold -= t.weight;
            if (threshold < 0) return t;
        }
        return tracks[0];
    }

    async synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput> {
        const seed = input.seed || input.text;
        const h = crypto.createHash('sha256').update(seed, 'utf8').digest();

        // P18-6.0 Resolved Library Routing
        const requestedId = input.libraryId || DEFAULT_BGM_LIBRARY_ID;
        const libraryId = BGM_LIBRARIES[requestedId] ? requestedId : DEFAULT_BGM_LIBRARY_ID;
        const libraryIdSource = !input.libraryId ? 'default' : (BGM_LIBRARIES[input.libraryId] ? 'project' : 'fallback');

        const library = BGM_LIBRARIES[libraryId];

        // P18-5.1 Weighted Selection from current library
        const track = this.weightedPick(h, library.tracks);

        const durationSec = input.preview ? 5.0 : 30.0;
        const outDir = path.join(process.cwd(), 'tmp', 'audio_bgm');
        fs.mkdirSync(outDir, { recursive: true });

        // P19-0.1: Multi-factor Cache Key
        const cacheObj = {
            seed,
            libraryId,
            libraryVersion: library.version,
            trackId: track.id,
            preview: !!input.preview,
            durationSec
        };
        const cacheKey = crypto.createHash('sha256').update(JSON.stringify(cacheObj)).digest('hex').slice(0, 16);
        const outPath = path.join(outDir, `bgm_lib_${cacheKey}.wav`);

        const lavfi = `sine=f=${track.baseFreq}:d=${durationSec},aecho=0.8:0.88:60:0.4,tremolo=f=${track.pulseFreq}:d=0.5`;

        const args = [
            '-y',
            '-f', 'lavfi',
            '-i', lavfi,
            '-ar', '48000',
            '-ac', '2',
            '-c:a', 'pcm_s16le',
            '-flags', '+bitexact',
            outPath
        ];

        if (fs.existsSync(outPath)) {
            // P18-6.2: 0-cost cache hit
            console.log(`[CACHE] Hit: ${outPath}`);
        } else {
            await this.run('ffmpeg', args);
        }

        const fileSha = sha256File(outPath);

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
                // P18-6.0 Hardened Audit
                model: libraryId,
                vendor: 'internal_library',
                bgmTrackId: track.id,
                bgmLibraryVersion: library.version,
                bgmSelectionSeed: seed,
                libraryId,
                libraryIdSource: libraryIdSource as any
            }
        };
    }
}
