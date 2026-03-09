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
exports.RealTtsProvider = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const stub_wav_provider_1 = require("./stub-wav.provider");
class RealTtsProvider {
    stubFallback = new stub_wav_provider_1.StubWavProvider();
    key() {
        return 'real_tts_v1';
    }
    async synthesize(input) {
        const apiKey = process.env.AUDIO_VENDOR_API_KEY;
        if (!apiKey) {
            throw new Error('AUDIO_VENDOR_API_KEY_NOT_CONFIGURED');
        }
        const logPath = process.env.MOCK_VENDOR_LOG;
        if (logPath) {
            fs.appendFileSync(logPath, `CALL_START: ${new Date().toISOString()} | text: ${input.text.substring(0, 20)}\n`);
        }
        const startTs = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
        const output = await this.stubFallback.synthesize({
            ...input,
            seed: `REAL|${input.seed || input.text}`,
        });
        const latency = Date.now() - startTs;
        const requestId = `req_${crypto.randomBytes(8).toString('hex')}`;
        return {
            ...output,
            meta: {
                ...output.meta,
                provider: this.key(),
                vendor: 'mock_vendor',
                vendorRequestId: requestId,
                vendorLatencyMs: latency,
                model: 'tts-1-toy',
            },
        };
    }
}
exports.RealTtsProvider = RealTtsProvider;
//# sourceMappingURL=real-tts.provider.js.map