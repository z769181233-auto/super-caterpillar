
import { PrismaClient } from '../../packages/database/src/generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ShotScript {
    shotId: string;
    sceneId: string;
    durationSec: number;
    visual_prompt: string;
    dialogue: string;
    characters: string[];
    index: number;
}

interface SceneScript {
    sceneId: string;
    sceneIndex: number;
    shots: ShotScript[];
}

async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        console.error("Usage: npx ts-node tools/prod/compile_video_script.ts <PROJECT_ID>");
        process.exit(1);
    }

    console.log(`[Script Compiler] Compiling Video Script for Project: ${projectId}`);

    // 1. Validate Project
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project not found: ${projectId}`);

    // 2. Fetch Scenes & Shots
    // V3.0: Ordered by sceneIndex
    const scenes = await prisma.scene.findMany({
        where: { projectId: projectId }, // or episode.projectId
        orderBy: { sceneIndex: 'asc' },
        include: {
            shots: {
                orderBy: { index: 'asc' }
            }
        }
    });

    if (scenes.length === 0) {
        // Fallback: Try fetching by episode if direct projectId link missing (legacy compat)
        console.warn("No scenes found by projectId, trying via Episode...");
        // Not implemented for simplicity, assuming CE06 V3.0 links scene.projectId
    }

    console.log(`Found ${scenes.length} scenes.`);

    const script: SceneScript[] = [];
    let totalShots = 0;

    for (const s of scenes) {
        const shotScripts: ShotScript[] = [];
        for (const sh of s.shots) {
            // Extract visual prompt (Priority: visualPrompt column > renderPayload > payload)
            let vp = sh.visualPrompt || "";
            if (!vp && sh.params) {
                const params = sh.params as any;
                vp = params.visual_prompt || params.prompt || "";
            }

            // Extract dialogue
            let diag = sh.dialogueContent || "";
            if (!diag && sh.params) {
                const params = sh.params as any;
                diag = params.dialogue || "";
            }

            // Extract characters (Naive: from assetBindings or regex)
            const chars: string[] = [];
            if (sh.assetBindings) {
                const ab = sh.assetBindings as any;
                if (ab.characters && Array.isArray(ab.characters)) {
                    chars.push(...ab.characters);
                }
            }

            // Fallback duration
            const dur = sh.durationSec ? Number(sh.durationSec) : 3;

            shotScripts.push({
                shotId: sh.id,
                sceneId: s.id,
                durationSec: dur,
                visual_prompt: vp,
                dialogue: diag,
                characters: chars,
                index: sh.index
            });
        }

        if (shotScripts.length > 0) {
            script.push({
                sceneId: s.id,
                sceneIndex: s.sceneIndex,
                shots: shotScripts
            });
            totalShots += shotScripts.length;
        }
    }

    // 3. Output
    const artifactsDir = path.join(process.cwd(), 'artifacts', 'script');
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const outFile = path.join(artifactsDir, 'video_script.json');
    fs.writeFileSync(outFile, JSON.stringify(script, null, 2));

    console.log(`[Success] Video Script Compiled: ${outFile}`);
    console.log(`Stats: ${script.length} Scenes, ${totalShots} Shots.`);

    if (totalShots === 0) {
        console.error("Error: No shots found in script.");
        process.exit(1);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
