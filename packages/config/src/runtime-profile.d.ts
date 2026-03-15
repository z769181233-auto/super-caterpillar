export interface RuntimeConfig {
    jobMaxInFlight: number;
    nodeMaxOldSpaceMb: number;
}
export declare function getRuntimeConfig(): RuntimeConfig;
