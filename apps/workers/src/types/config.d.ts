declare module '@scu/config' {
  export const env: {
    nodeEnv: string;
    isDevelopment: boolean;
    isProduction: boolean;
    databaseUrl: string;
    redisUrl: string;
    apiPort: number;
    apiHost: string;
    apiUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshSecret: string;
    jwtRefreshExpiresIn: string;
    appName: string;
    appVersion: string;
    frontendUrl: string;
    bcryptSaltRounds: number;
    jobWorkerEnabled: boolean;
    jobWorkerInterval: number;
    jobWorkerBatchSize: number;
    workerApiKey?: string;
    workerApiSecret?: string;
    workerId: string;
    workerName: string;
    workerPollInterval: number;
    engineDefault: string;
    engineRealHttpBaseUrl: string;
    HMAC_TIMESTAMP_WINDOW: number;
    HMAC_SIGNATURE_ALGORITHM: string;
  };
  export const config: typeof env;
}
