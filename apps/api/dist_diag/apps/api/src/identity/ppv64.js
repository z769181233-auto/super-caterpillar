"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ppv64FromImage = ppv64FromImage;
exports.cosine = cosine;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
function sha256File(path) {
    const buf = fs.readFileSync(path);
    return crypto.createHash('sha256').update(buf).digest('hex');
}
function sha256Float32(vec) {
    const buf = Buffer.from(vec.buffer);
    return crypto.createHash('sha256').update(buf).digest('hex');
}
async function ppv64FromImage(absPath, decodeRGBA) {
    const { width, height, rgba } = await decodeRGBA(absPath);
    const gridW = 8, gridH = 8;
    const out = new Float32Array(64);
    for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
            const x0 = Math.floor((gx * width) / gridW);
            const x1 = Math.floor(((gx + 1) * width) / gridW);
            const y0 = Math.floor((gy * height) / gridH);
            const y1 = Math.floor(((gy + 1) * height) / gridH);
            let sum = 0;
            let cnt = 0;
            for (let y = y0; y < Math.max(y0 + 1, y1); y++) {
                for (let x = x0; x < Math.max(x0 + 1, x1); x++) {
                    const idx = (y * width + x) * 4;
                    const r = rgba[idx];
                    const g = rgba[idx + 1];
                    const b = rgba[idx + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    sum += gray;
                    cnt++;
                }
            }
            out[gy * gridW + gx] = cnt > 0 ? sum / cnt : 0;
        }
    }
    let mean = 0;
    for (let i = 0; i < 64; i++)
        mean += out[i];
    mean /= 64;
    let varSum = 0;
    for (let i = 0; i < 64; i++) {
        const d = out[i] - mean;
        varSum += d * d;
    }
    const std = Math.sqrt(varSum / 64) + 1e-6;
    let norm = 0;
    for (let i = 0; i < 64; i++) {
        out[i] = (out[i] - mean) / std;
        norm += out[i] * out[i];
    }
    norm = Math.sqrt(norm) + 1e-6;
    for (let i = 0; i < 64; i++)
        out[i] /= norm;
    return {
        vec: out,
        embeddingHash: sha256Float32(out),
        fileSha256: sha256File(absPath),
    };
}
function cosine(a, b) {
    let dot = 0;
    for (let i = 0; i < 64; i++)
        dot += a[i] * b[i];
    const v = Math.max(-1, Math.min(1, dot));
    return (v + 1) / 2;
}
//# sourceMappingURL=ppv64.js.map