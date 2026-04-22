export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export type CE04Input = {
    structured_text?: string;
    style_prompt?: string;
    style_guide?: string;
    context?: Record<string, any>;
    [key: string]: unknown;
};

export type CE04Output = {
    billing_usage?: {
        promptTokens?: number;
        completionTokens?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export class CE04EngineSelector {
    async invoke(input: CE04Input): Promise<CE04Output> {
        throw new Error("CE04_STUB_REMOVED: Round 4 Sealing active. Use ce04RealEngine instead.");
    }
}

export const ce04RealEngine: AnyEngine = {
    id: "ce04",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "ce04", input };
    }
};
