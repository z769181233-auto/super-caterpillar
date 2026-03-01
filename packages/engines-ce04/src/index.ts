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
        return { ok: true, engine: "ce04-stub", input } as any;
    }
}

export const ce04RealEngine: AnyEngine = {
    id: "ce04",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "ce04", input };
    }
};
