export type AnyEngine = {
    id: string;
    kind: string;
    run: (input: unknown) => Promise<unknown>;
};

export const sceneCompositionRealEngine: AnyEngine = {
    id: "scene-composition",
    kind: "real",
    async run(input: unknown) {
        return { ok: true, engine: "scene-composition", input };
    }
};
