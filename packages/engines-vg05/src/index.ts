export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export const vg05RealEngine: AnyEngine = {
    id: "vg05",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "vg05", input };
    }
};
