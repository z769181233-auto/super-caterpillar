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
exports.readFileUnderLimit = readFileUnderLimit;
exports.readBufferUnderLimit = readBufferUnderLimit;
exports.safeJoin = safeJoin;
const fs = __importStar(require("fs"));
const util = __importStar(require("util"));
const readFileAsync = util.promisify(fs.readFile);
const statAsync = util.promisify(fs.stat);
async function readFileUnderLimit(filePath, maxBytes = 5 * 1024 * 1024) {
    const stats = await statAsync(filePath);
    if (stats.size > maxBytes) {
        throw new Error(`FILE_SIZE_EXCEEDED: File ${filePath} is ${stats.size} bytes, limit is ${maxBytes} bytes. Use streams.`);
    }
    return await readFileAsync(filePath, 'utf-8');
}
async function readBufferUnderLimit(filePath, maxBytes = 5 * 1024 * 1024) {
    const stats = await statAsync(filePath);
    if (stats.size > maxBytes) {
        throw new Error(`FILE_SIZE_EXCEEDED: File ${filePath} is ${stats.size} bytes, limit is ${maxBytes} bytes. Use streams.`);
    }
    return await readFileAsync(filePath);
}
const path = __importStar(require("path"));
function safeJoin(root, key) {
    const cleaned = key.replace(/^file:\/\//, '').replace(/^\/+/, '');
    const full = path.resolve(root, cleaned);
    const rootAbs = path.resolve(root);
    if (!full.startsWith(rootAbs + path.sep) && full !== rootAbs) {
        throw new Error(`PATH_TRAVERSAL_BLOCKED: Key "${key}" attempts to escape root "${rootAbs}"`);
    }
    return full;
}
//# sourceMappingURL=fs_safe.js.map