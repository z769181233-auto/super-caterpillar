export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export const vg04RealEngine: AnyEngine = {
    id: "vg04",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "vg04", input };
    }
};
