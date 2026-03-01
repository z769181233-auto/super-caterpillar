import sharp from 'sharp';
import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import axios from 'axios';
import { pipeline } from 'stream/promises';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

const SHOTS = [
    {
        id: "s01_shot01", char: "zhang_ruochen", voice: "Yating",
        prompt: "Zhang Ruochen, silver hair, bloodshot eyes, chest pierced by sword, blood-red void background, peak guoman 3D sub-surface scattering style, masterpiece",
        text: "池瑶……为什么？我待你如挚爱，你为何要杀我？"
    },
    {
        id: "s01_shot02", char: "chi_yao", voice: "Ting-Ting",
        prompt: "Chi Yao, Empress in golden gown, holding blood-stained sword, cold expression, turning back, dark void, peak guoman 3D style",
        text: "神道无情，斩情绝爱。"
    },
    {
        id: "s02_shot01", char: "lin_fei", voice: "Mei-Jia",
        prompt: "Lin Fei, gentle woman in light blue Hanfu, worried face, running in cold palace, snow outside, peak guoman 3D style",
        text: "尘儿，你醒了，感觉好些了吗？"
    },
    {
        id: "s03_shot01", char: "eighth_prince", voice: "Yating",
        prompt: "Eighth Prince Zhang Ji, arrogant face, sinister smirk, dark purple robes, stepping into room, snow swirling, peak guoman 3D style",
        text: "九弟，这玉漱宫归我母亲了。带着这个贱妃滚吧。"
    }
];

async function runProduction() {
    console.log(`\n=== SCU 2.0 FULL BATCH PRODUCTION: Episode 1 Pilot ===`);

    for (const shot of SHOTS) {
        console.log(`\n>>> [BATTLE_RENDER] Shot: ${shot.id} | Character: ${shot.char}`);
        const outDir = path.join(repoRoot, 'storage', 'videos', `v7_final_${shot.id}`);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // Step 1: V7 Base Frame (Lossless Inlay)
        const anchor = path.join(brainDir, `${shot.char}_v10_final_perfection.png`);
        const faceROI = await sharp(anchor).extract({ left: 300, top: 120, width: 424, height: 424 }).resize(320, 320).png().toBuffer();
        const baseFrame = path.join(outDir, 'base_inlay.png');
        await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 15, g: 15, b: 20 } } })
            .composite([{ input: faceROI, top: 180, left: 352 }]).png().toFile(baseFrame);

        console.log(`[Replicate] Global Fusion (0.35)...`);
        const sdxl = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", {
            input: { image: `data:image/png;base64,${fs.readFileSync(baseFrame).toString('base64')}`, prompt: shot.prompt, strength: 0.35 }
        }) as any;
        const firstFrame = path.join(outDir, 'first_frame.png');
        await downloadFile(sdxl[0] || sdxl, firstFrame);

        // Step 2: I2V Motion
        console.log(`[Replicate] I2V Motion...`);
        const video = await replicate.run("stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438", {
            input: { input_image: `data:image/png;base64,${fs.readFileSync(firstFrame).toString('base64')}`, motion_bucket_id: 127 }
        }) as any;
        const rawVid = path.join(outDir, 'raw.mp4');
        await downloadFile(video, rawVid);

        // Step 3: FFmpeg Performance (Zoom + LipSync)
        console.log(`[Perform] Final Composite...`);
        const zoomed = path.join(outDir, 'zoomed.mp4');
        const filter = "scale=1280:720,zoompan=z='zoom+0.001':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=100:s=1280x720";
        execSync(`ffmpeg -y -i "${rawVid}" -vf "${filter}" -c:v libx264 -pix_fmt yuv420p "${zoomed}" 2>/dev/null`);

        const wav = path.join(outDir, 'voice.wav');
        execSync(`say -v ${shot.voice} -o "${wav}.aiff" -- "${shot.text}"`);
        execSync(`ffmpeg -y -i "${wav}.aiff" -ar 16000 -ac 1 "${wav}" 2>/dev/null`);

        const sync = await replicate.run("sync/lipsync-2", {
            input: { video: fs.readFileSync(zoomed), audio: fs.readFileSync(wav) }
        }) as any;

        const final = path.join(outDir, 'FINAL_SCU20.mp4');
        await downloadFile(sync.video || sync, final);
        console.log(`[DONE] ${final}`);
    }
}

runProduction().catch(console.error);
