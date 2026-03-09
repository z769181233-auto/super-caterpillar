"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NlpCache = void 0;
const crypto_1 = require("crypto");
class NlpCache {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    generateKey(engineName, payload) {
        const str = JSON.stringify(payload);
        const hash = (0, crypto_1.createHash)('sha256').update(str).digest('hex');
        return `nlp_cache:${engineName}:v1:${hash}`;
    }
    async get(key) {
        try {
            return await this.redis.getJson(key);
        }
        catch {
            return null;
        }
    }
    async set(key, value, ttlSeconds = 60 * 60 * 24 * 7) {
        await this.redis.setJson(key, value, ttlSeconds);
    }
}
exports.NlpCache = NlpCache;
//# sourceMappingURL=nlp_cache.js.map