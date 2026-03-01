export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export const ce08RealEngine: AnyEngine = {
    id: "ce08",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "ce08", input };
    }
};
