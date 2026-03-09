export type Ppv64Result = {
    vec: Float32Array;
    embeddingHash: string;
    fileSha256: string;
};
export type DecodeRGBA = (absPath: string) => Promise<{
    width: number;
    height: number;
    rgba: Uint8Array;
}>;
export declare function ppv64FromImage(absPath: string, decodeRGBA: DecodeRGBA): Promise<Ppv64Result>;
export declare function cosine(a: Float32Array, b: Float32Array): number;
