"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NlpTokenizer = void 0;
class NlpTokenizer {
    static countChars(text) {
        if (!text)
            return 0;
        return text.length;
    }
    static estimateTokens(text) {
        if (!text)
            return 0;
        const words = text.split(/\s+/).length;
        const chars = text.length;
        return Math.max(words, Math.ceil(chars / 2));
    }
}
exports.NlpTokenizer = NlpTokenizer;
//# sourceMappingURL=nlp_tokenizer.js.map