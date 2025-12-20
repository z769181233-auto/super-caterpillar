export interface MetricLabel {
    [key: string]: string;
}

export class TextSafetyMetrics {
    private static metrics = {
        text_safety_decision_total: new Map<string, number>(), // key: decision=PASS
        text_safety_latency_ms: [] as number[], // Simple histogram bucket behavior simulated by just exposing raw sum/count or keeping internal accumulation
        signed_url_refresh_total: 0,
        signed_url_access_denied_total: 0,
    };

    // Keep track of sum and count for latency to calc avg or just expose sum/count
    private static latencySum = 0;
    private static latencyCount = 0;

    static recordDecision(decision: 'PASS' | 'WARN' | 'BLOCK') {
        const key = `decision=${decision}`;
        this.metrics.text_safety_decision_total.set(key, (this.metrics.text_safety_decision_total.get(key) || 0) + 1);
    }

    static recordLatency(ms: number) {
        this.latencySum += ms;
        this.latencyCount++;
        // Optional: Keep a circular buffer if we wanted percentiles, but for now simple stats
    }

    static recordSignedUrlRefresh() {
        this.metrics.signed_url_refresh_total++;
    }

    static recordSignedUrlDeny() {
        this.metrics.signed_url_access_denied_total++;
    }

    static getPrometheusOutput(): string {
        const lines: string[] = [];

        // text_safety_decision_total
        lines.push('# HELP text_safety_decision_total Total text safety decisions by result');
        lines.push('# TYPE text_safety_decision_total counter');
        const decisions = ['PASS', 'WARN', 'BLOCK'];
        for (const d of decisions) {
            const val = this.metrics.text_safety_decision_total.get(`decision=${d}`) || 0;
            lines.push(`text_safety_decision_total{decision="${d}"} ${val}`);
        }

        // text_safety_latency_ms (Summary/Histogram equivalent)
        // Expose count and sum for rate calculation
        lines.push('# HELP text_safety_latency_ms_sum Total latency in ms for text safety checks');
        lines.push('# TYPE text_safety_latency_ms_sum counter');
        lines.push(`text_safety_latency_ms_sum ${this.latencySum}`);

        lines.push('# HELP text_safety_latency_ms_count Total number of text safety checks');
        lines.push('# TYPE text_safety_latency_ms_count counter');
        lines.push(`text_safety_latency_ms_count ${this.latencyCount}`);

        // signed_url_refresh_total
        lines.push('# HELP signed_url_refresh_total Total signed URL refresh operations');
        lines.push('# TYPE signed_url_refresh_total counter');
        lines.push(`signed_url_refresh_total ${this.metrics.signed_url_refresh_total}`);

        // signed_url_access_denied_total
        lines.push('# HELP signed_url_access_denied_total Total failed access attempts to signed/storage resources');
        lines.push('# TYPE signed_url_access_denied_total counter');
        lines.push(`signed_url_access_denied_total ${this.metrics.signed_url_access_denied_total}`);

        return lines.join('\n');
    }
}
