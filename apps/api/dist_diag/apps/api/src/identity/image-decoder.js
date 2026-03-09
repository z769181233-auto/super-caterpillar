"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeSharpDecoder = void 0;
const sharp_1 = __importDefault(require("sharp"));
const nodeSharpDecoder = async (absPath) => {
    const { data, info } = await (0, sharp_1.default)(absPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return {
        width: info.width,
        height: info.height,
        rgba: new Uint8Array(data),
    };
};
exports.nodeSharpDecoder = nodeSharpDecoder;
//# sourceMappingURL=image-decoder.js.map