export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export const vg03RealEngine: AnyEngine = {
    id: "vg03",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "vg03", input };
    }
};
