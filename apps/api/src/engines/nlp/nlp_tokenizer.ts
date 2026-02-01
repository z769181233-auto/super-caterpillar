/**
 * NLP Tokenizer
 * 负责统一的技术计数（字符/Token），作为计费和配额依据
 */
export class NlpTokenizer {
    /**
     * 简单的字符计数（中文/英文混合处理）
     */
    static countChars(text: string): number {
        if (!text) return 0;
        return text.length;
    }

    /**
     * 实现基础的 Word/Token 估算 (基于空白符)
     */
    static estimateTokens(text: string): number {
        if (!text) return 0;
        // 中文粗略按照字符数，英文按照空格分割
        const words = text.split(/\s+/).length;
        const chars = text.length;
        return Math.max(words, Math.ceil(chars / 2)); // 极简估算模型
    }
}
