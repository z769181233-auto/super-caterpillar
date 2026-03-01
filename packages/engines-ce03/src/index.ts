export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export type CE03Input = {
    structured_text?: string;
    context?: Record<string, any>;
    [key: string]: unknown;
};

export type CE03Output = {
    billing_usage?: {
        promptTokens?: number;
        completionTokens?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export class CE03EngineSelector {
    async invoke(input: CE03Input): Promise<CE03Output> {
        return { ok: true, engine: "ce03-stub", input } as any;
    }
}

export const ce03RealEngine: AnyEngine = {
    id: "ce03",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "ce03", input };
    }
};
