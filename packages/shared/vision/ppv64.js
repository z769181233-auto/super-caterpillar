"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ppv64FromImage = ppv64FromImage;
exports.ppv64Similarity = ppv64Similarity;
const sharp_1 = __importDefault(require("sharp"));
async function ppv64FromImage(filePath) {
    const { data, info } = await (0, sharp_1.default)(filePath)
        .greyscale()
        .resize(8, 8, {
        kernel: sharp_1.default.kernel.lanczos3,
        fit: 'fill',
    })
        .raw()
        .toBuffer({ resolveWithObject: true });
    if (data.length !== 64) {
        throw new Error(`PPV64_INTERNAL_ERROR: Expected 64 bytes, got ${data.length}`);
    }
    const rawVector = Array.from(data);
    let sum = 0;
    for (const v of rawVector)
        sum += v;
    const mean = sum / 64;
    let sumSqDiff = 0;
    for (const v of rawVector)
        sumSqDiff += Math.pow(v - mean, 2);
    const variance = sumSqDiff / 64;
    const std = Math.sqrt(variance) + 1e-6;
    const zNormalized = rawVector.map((x) => (x - mean) / std);
    let sumSq = 0;
    for (const v of zNormalized)
        sumSq += v * v;
    const magnitude = Math.sqrt(sumSq) + 1e-6;
    const l2Normalized = zNormalized.map((x) => x / magnitude);
    return l2Normalized;
}
function ppv64Similarity(vecA, vecB) {
    if (vecA.length !== 64 || vecB.length !== 64) {
        throw new Error('PPV64_DIMENSION_MISMATCH: Vectors must be 64-dimensional');
    }
    const cosine = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const mapped = (cosine + 1) / 2;
    return Math.max(0, Math.min(1, mapped));
}
//# sourceMappingURL=ppv64.js.map