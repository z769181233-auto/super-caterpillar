export declare class SecretEncryptionService {
    private readonly algorithm;
    private readonly keyLength;
    private readonly ivLength;
    private readonly tagLength;
    private getMasterKey;
    encryptSecret(plainSecret: string): {
        enc: string;
        iv: string;
        tag: string;
    };
    decryptSecret(enc: string, iv: string, tag: string): string;
    isMasterKeyConfigured(): boolean;
}
