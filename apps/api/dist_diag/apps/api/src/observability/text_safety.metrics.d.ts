export interface MetricLabel {
    [key: string]: string;
}
export declare class TextSafetyMetrics {
    private static metrics;
    private static latencySum;
    private static latencyCount;
    static recordDecision(decision: 'PASS' | 'WARN' | 'BLOCK'): void;
    static recordLatency(ms: number): void;
    static recordSignedUrlRefresh(): void;
    static recordSignedUrlDeny(): void;
    static getPrometheusOutput(): string;
}
