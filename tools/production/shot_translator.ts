import * as fs from 'fs';
import * as path from 'path';

/**
 * Shot Translator (Mock/Heuristic for now, can be replaced by real LLM call)
 * 职责：将 video_script 中的描述映射为 ShotSpec 硬约束
 */

const SAMPLE_SCRIPT = [
    {
        id: "s01_shot01",
        charId: "zhang_ruochen",
        visual: "张若尘被剑光包围，愤怒质问池瑶。特写。俯视。",
        dialogue: "池瑶，我待你如挚爱，你为何要杀我？"
    },
    {
        id: "s01_shot02",
        charId: "chi_yao",
        visual: "池瑶皇后冷漠转身。中景。平視。",
        dialogue: "神道无情，斩情绝爱。"
    },
    {
        id: "s02_shot01",
        charId: "lin_fei",
        visual: "林妃推门而入，雪花随风飘进。远景。仰視。",
        dialogue: "尘儿，你醒了？"
    }
];

function translateToSpec(scriptItem: any) {
    // 启发式映射 (Heuristics)
    const visual = scriptItem.visual || "";

    let framing: any = "MS";
    if (visual.includes("特写")) framing = "CU";
    if (visual.includes("远景")) framing = "LS";
    if (visual.includes("近景")) framing = "MCU";

    let angle: any = "eye";
    if (visual.includes("俯视")) angle = "low"; // Note: Framing logic can be tricky
    if (visual.includes("仰视")) angle = "high";

    return {
        shotId: scriptItem.id,
        characterId: scriptItem.charId,
        framing: framing,
        cameraAngle: angle,
        motionIntensity: 5,
        lighting: "Cinematic",
        environment: visual,
        actionDescription: visual,
        dialogue: scriptItem.dialogue,
        anchorAngle: visual.includes("转身") ? "back" : "front"
    };
}

const specs = SAMPLE_SCRIPT.map(translateToSpec);
const outPath = path.join(process.cwd(), 'storage', 'projects', 'wangu_ep1_v5', 'shot_specs.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ episodeId: "wangu_ep1_v5", shots: specs }, null, 4));

console.log(`[Success] ShotSpecs generated at ${outPath}`);
