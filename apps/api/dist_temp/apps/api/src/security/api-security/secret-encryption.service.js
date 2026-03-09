"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretEncryptionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let SecretEncryptionService = class SecretEncryptionService {
    algorithm = 'aes-256-gcm';
    keyLength = 32;
    ivLength = 12;
    tagLength = 16;
    getMasterKey() {
        const masterKeyB64 = process.env.API_KEY_MASTER_KEY_B64;
        if (!masterKeyB64) {
            throw new common_1.InternalServerErrorException('API_KEY_MASTER_KEY_B64 environment variable is required for secret encryption');
        }
        try {
            const key = Buffer.from(masterKeyB64, 'base64');
            if (key.length !== this.keyLength) {
                throw new Error(`Master key must be ${this.keyLength} bytes (got ${key.length})`);
            }
            return key;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Invalid API_KEY_MASTER_KEY_B64 format: ${error.message}`);
        }
    }
    encryptSecret(plainSecret) {
        const masterKey = this.getMasterKey();
        const iv = (0, crypto_1.randomBytes)(this.ivLength);
        const cipher = (0, crypto_1.createCipheriv)(this.algorithm, masterKey, iv);
        let encrypted = cipher.update(plainSecret, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            enc: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
        };
    }
    decryptSecret(enc, iv, tag) {
        const masterKey = this.getMasterKey();
        try {
            const encryptedBuffer = Buffer.from(enc, 'base64');
            const ivBuffer = Buffer.from(iv, 'base64');
            const tagBuffer = Buffer.from(tag, 'base64');
            const decipher = (0, crypto_1.createDecipheriv)(this.algorithm, masterKey, ivBuffer);
            decipher.setAuthTag(tagBuffer);
            let decrypted = decipher.update(encryptedBuffer);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString('utf8');
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Failed to decrypt secret: ${error.message}`);
        }
    }
    isMasterKeyConfigured() {
        try {
            this.getMasterKey();
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.SecretEncryptionService = SecretEncryptionService;
exports.SecretEncryptionService = SecretEncryptionService = __decorate([
    (0, common_1.Injectable)()
], SecretEncryptionService);
//# sourceMappingURL=secret-encryption.service.js.map