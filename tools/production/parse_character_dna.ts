import * as fs from 'fs';
import * as path from 'path';

// 加載環境變數
const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

let apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey.startsWith('"') && apiKey.endsWith('"')) {
    apiKey = apiKey.slice(1, -1);
}

if (!apiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
}

// 移除 SDK 初始化

async function parseCharacterDNA(characterName: string, characterId: string, text: string) {
    const systemPrompt = `You are a strict and professional character designer for high-end 3D CGI Chinese Animation.
Your task is to perform "Whole-book aggregation" parsing on the provided novel text to extract the definitive visual identity (Visual DNA) of the character: "${characterName}".

Requirements:
1. Extract ALL sentences related to the character's appearance, face, hair, body, clothings, and aura.
2. Resolve conflicts using the following logic: "latest appearance", "highest weight/most explicit description", "most frequently mentioned".
3. Group attributes rigorously into "hard_constraints" (core identity that must never change) and "soft_constraints" (clothing, expressions that change per scene).
4. Extract "forbidden" constraints (things that must never appear, e.g. beard, wrinkles, armor if he's a delicate swordsman, etc.).
5. Draft a "canonical_prompt": A very concise, highly stable English prompt string summarizing the core visualization logic (no more than 3 sentences).
6. Draft a "negative_prompt": English keywords of forbidden elements to pass directly to an image model.
7. Provide an "evidence_quotes" object mapping a specific constraint string back to the exact original Chinese quote from the text.

YOUR RESPONSE MUST BE EXCLUSIVELY A VALID JSON OBJECT WITH THE FOLLOWING STRUCTURE:
{
  "id": "${characterId}",
  "name": "${characterName}",
  "hard_constraints": ["constraint 1", "constraint 2"],
  "soft_constraints": ["var 1"],
  "forbidden": ["avoid 1", "avoid 2"],
  "canonical_prompt": "Concise prompt... Unreal Engine 5 render, Masterpiece 3D CGI",
  "negative_prompt": "negative keyword 1, negative keyword 2...",
  "evidence_quotes": {
    "constraint 1": "original text quote exactly as it appears in text"
  }
}`;

    console.log(`Analyzing DNA for character: ${characterName} using Gemini 1.5 Flash (REST)...`);

    let rawOutput: string = "";
    const maxRetries = 15;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nNovel Text:\n${text}` }] }],
                    generationConfig: { temperature: 0.2 }
                })
            });

            if (response.status === 429) {
                const retryDelay = Math.pow(2, i) * 5000 + Math.random() * 2000;
                console.log(`[429 Rate Limit] Retrying in ${Math.round(retryDelay / 1000)}s... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, retryDelay));
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (!rawOutput) throw new Error("Empty response from Gemini API");
            break; // success
        } catch (e: any) {
            console.error(`[Error] Attempt ${i + 1}/${maxRetries}:`, e.message);
            if (i === maxRetries - 1) throw e;
            const retryDelay = Math.pow(2, i) * 5000 + Math.random() * 2000;
            await new Promise(r => setTimeout(r, retryDelay));
        }
    }

    if (!rawOutput) throw new Error("Failed to generate content after max retries.");

    // Strip markdown code block wrappers if any
    rawOutput = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(rawOutput);
}

async function main() {
    const sourcePath = path.join(repoRoot, 'docs/_specs/wangu_ep1_source.txt');
    if (!fs.existsSync(sourcePath)) {
        console.error("Source file not found at:", sourcePath);
        return;
    }

    const novelText = fs.readFileSync(sourcePath, 'utf8');

    const characterName = "张若尘";
    const characterId = "zhang_ruochen";

    try {
        const dna = await parseCharacterDNA(characterName, characterId, novelText);

        const outDir = path.join(repoRoot, `storage/characters/${characterId}/profiles`);
        fs.mkdirSync(outDir, { recursive: true });

        // Save SSOT JSON
        const specPath = path.join(outDir, 'CharacterSpec.json');
        fs.writeFileSync(specPath, JSON.stringify(dna, null, 2), 'utf8');
        console.log(`[SUCCESS] Character SSOT saved to ${specPath}`);

        // Save Evidence
        const evidencePath = path.join(outDir, 'evidence.md');
        let evidenceMd = `# Evidence Quotes for ${characterName} (${characterId})\n\n`;
        evidenceMd += `> Extracted using Gemini 1.5 Pro Whole-book Aggregation\n\n`;

        for (const [key, quote] of Object.entries(dna.evidence_quotes || {})) {
            evidenceMd += `### Feature: ${key}\n- **Quote**: "${quote}"\n\n`;
        }

        fs.writeFileSync(evidencePath, evidenceMd, 'utf8');
        console.log(`[SUCCESS] Evidence Report saved to ${evidencePath}`);

    } catch (e: any) {
        console.error("Failed to parse Character DNA:", e);
    }
}

main();
