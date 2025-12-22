import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from 'config';

/**
 * Secret Encryption Service
 * 
 * 负责 API Key secret 的加密/解密（AES-256-GCM）
 * 
 * 参考文档：
 * - 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》
 */
@Injectable()
export class SecretEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 32 bytes = 256 bits
  private readonly ivLength = 12; // 12 bytes for GCM (recommended)
  private readonly tagLength = 16; // 16 bytes for GCM tag

  /**
   * 获取主密钥（从环境变量读取）
   * 
   * @returns 主密钥 Buffer（32 bytes）
   * @throws {InternalServerErrorException} 如果主密钥不存在或格式错误
   */
  private getMasterKey(): Buffer {
    const masterKeyB64 = process.env.API_KEY_MASTER_KEY_B64;
    
    if (!masterKeyB64) {
      throw new InternalServerErrorException(
        'API_KEY_MASTER_KEY_B64 environment variable is required for secret encryption',
      );
    }

    try {
      const key = Buffer.from(masterKeyB64, 'base64');
      if (key.length !== this.keyLength) {
        throw new Error(`Master key must be ${this.keyLength} bytes (got ${key.length})`);
      }
      return key;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Invalid API_KEY_MASTER_KEY_B64 format: ${error.message}`,
      );
    }
  }

  /**
   * 加密 secret
   * 
   * @param plainSecret 明文 secret（字符串）
   * @returns 加密后的三元组（enc/iv/tag，均为 base64）
   */
  encryptSecret(plainSecret: string): { enc: string; iv: string; tag: string } {
    const masterKey = this.getMasterKey();
    const iv = randomBytes(this.ivLength);
    
    const cipher = createCipheriv(this.algorithm, masterKey, iv);
    
    let encrypted = cipher.update(plainSecret, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    return {
      enc: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /**
   * 解密 secret
   * 
   * @param enc 加密后的 secret（base64）
   * @param iv IV（base64）
   * @param tag 认证标签（base64）
   * @returns 明文 secret（字符串）
   * @throws {InternalServerErrorException} 如果解密失败
   */
  decryptSecret(enc: string, iv: string, tag: string): string {
    const masterKey = this.getMasterKey();
    
    try {
      const encryptedBuffer = Buffer.from(enc, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');
      const tagBuffer = Buffer.from(tag, 'base64');
      
      const decipher = createDecipheriv(this.algorithm, masterKey, ivBuffer);
      decipher.setAuthTag(tagBuffer);
      
      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to decrypt secret: ${error.message}`,
      );
    }
  }

  /**
   * 检查主密钥是否配置
   * 
   * @returns true 如果主密钥已配置
   */
  isMasterKeyConfigured(): boolean {
    try {
      this.getMasterKey();
      return true;
    } catch {
      return false;
    }
  }
}

