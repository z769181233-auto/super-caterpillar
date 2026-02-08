import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

type DropMeta = {
    shotId?: string;
    jobId?: string;
    engine?: string;
    createdAt?: string; // ISO
    source?: { kind?: string; uri?: string; storageKey?: string };
};

function mustInsideDir(dir: string, file: string) {
    const resolvedDir = path.resolve(dir);
    const resolvedFile = path.resolve(file);
    if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
        throw new Error(`Path escape detected: ${resolvedFile} not in ${resolvedDir}`);
    }
}

async function sha256File(filePath: string): Promise<string> {
    return await new Promise((resolve, reject) => {
        const h = crypto.createHash('sha256');
        const s = fs.createReadStream(filePath);
        s.on('data', (d) => h.update(d));
        s.on('error', reject);
        s.on('end', () => resolve(h.digest('hex')));
    });
}

function atomicWriteFile(target: string, content: string | Buffer) {
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, target);
}

function atomicCopyFile(src: string, dst: string) {
    const tmp = dst + '.tmp';
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dst);
}

function runFfprobeJson(mp4Path: string): any {
    const r = spawnSync('ffprobe', [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        mp4Path,
    ], { encoding: 'utf8' });

    if (r.status !== 0) {
        throw new Error(`ffprobe failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout);
}

export async function dropOriginNativeFourPack(params: {
    artifactDir: string;
    mp4Path: string;
    meta: DropMeta;
}) {
    const { artifactDir, mp4Path } = params;
    if (!artifactDir) throw new Error('ARTIFACT_DIR is required');
    if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

    const ART = path.resolve(artifactDir);
    const OUT_MP4 = path.join(ART, 'shot_render_output.mp4');
    const OUT_FFPROBE = path.join(ART, 'shot_render_output.ffprobe.json');
    const OUT_SHA = path.join(ART, 'shot_render_output.sha256');
    const OUT_META = path.join(ART, 'shot_render_output.meta.json');
    const MARK = path.join(ART, 'ORIGIN_NATIVE_DROP_OK.txt');

    // safety: ensure inside dir
    [OUT_MP4, OUT_FFPROBE, OUT_SHA, OUT_META, MARK].forEach(f => mustInsideDir(ART, f));

    // idempotency: if marker exists and files exist -> verify sha
    if (fs.existsSync(MARK)) {
        const ok =
            fs.existsSync(OUT_MP4) && fs.statSync(OUT_MP4).size > 0 &&
            fs.existsSync(OUT_FFPROBE) &&
            fs.existsSync(OUT_SHA) &&
            fs.existsSync(OUT_META);
        if (ok) {
            const recorded = fs.readFileSync(OUT_SHA, 'utf8').trim();
            const real = await sha256File(OUT_MP4);
            if (recorded === real) return { reused: true, artifactDir: ART };
        }
        // marker exists but invalid -> fallthrough to rewrite (still no fallback from TEMP)
    }

    if (!fs.existsSync(mp4Path) || fs.statSync(mp4Path).size <= 0) {
        throw new Error(`mp4Path missing or empty: ${mp4Path}`);
    }

    // 1) mp4 (atomic copy)
    atomicCopyFile(mp4Path, OUT_MP4);

    // 2) ffprobe
    const ffj = runFfprobeJson(OUT_MP4);
    atomicWriteFile(OUT_FFPROBE, JSON.stringify(ffj, null, 2) + '\n');

    // 3) sha256
    const sha = await sha256File(OUT_MP4);
    atomicWriteFile(OUT_SHA, sha + '\n');

    // 4) meta.json (minimal but sufficient)
    const createdAt = new Date().toISOString();
    const videoStream = (ffj.streams || []).find((s: any) => s.codec_type === 'video');
    const duration = Number(ffj.format?.duration || 0);
    const nbFrames = Number(videoStream?.nb_frames || 0);
    const fpsRaw = videoStream?.avg_frame_rate || '';
    const meta = {
        ...params.meta,
        createdAt,
        bytes: fs.statSync(OUT_MP4).size,
        durationSec: duration,
        nbFrames,
        fps: fpsRaw,
    };
    atomicWriteFile(OUT_META, JSON.stringify(meta, null, 2) + '\n');

    // marker
    const lines = [
        'OK ORIGIN_NATIVE_DROP',
        `shot_render_output.mp4`,
        `shot_render_output.ffprobe.json`,
        `shot_render_output.sha256`,
        `shot_render_output.meta.json`,
        `sha256=${sha}`,
        `bytes=${meta.bytes}`,
        `durationSec=${meta.durationSec}`,
        `nbFrames=${meta.nbFrames}`,
        `fps=${meta.fps}`,
        `createdAt=${meta.createdAt}`,
    ];
    atomicWriteFile(MARK, lines.join('\n') + '\n');

    return { reused: false, artifactDir: ART };
}
