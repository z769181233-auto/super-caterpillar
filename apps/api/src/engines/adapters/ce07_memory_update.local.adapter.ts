/**
 * CE07 Memory Update (REAL)
 * Rules:
 * - missing DB => FAIL
 * - must be auditable (inputs hash + outputs hash + timing)
 */
export type CE07MemoryType = "relationship" | "knowledge" | "emotion" | "skill";

export interface CE07MemoryInput {
    characterId: string;
    sceneId: string;
    memoryType: CE07MemoryType;
    content: string;
    ts?: string; // ISO
}

export interface CE07MemoryResult {
    status: "PASS";
    recordId: string;
    meta: { characterId: string; sceneId: string; memoryType: CE07MemoryType };
}

export class CE07MemoryUpdateAdapter {
    async run(_input: CE07MemoryInput): Promise<CE07MemoryResult> {
        // TODO: connect to your existing DB layer (Prisma/SQL) and write+readback assert.
        // IMPORTANT: do not return PASS unless write+readback succeeded.
        throw new Error("CE07MemoryUpdateAdapter not wired to DB yet");
    }
}
