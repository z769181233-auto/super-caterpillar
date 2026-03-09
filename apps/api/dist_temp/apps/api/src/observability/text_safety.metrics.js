"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextSafetyMetrics = void 0;
class TextSafetyMetrics {
    static metrics = {
        text_safety_decision_total: new Map(),
        text_safety_latency_ms: [],
        signed_url_refresh_total: 0,
        signed_url_access_denied_total: 0,
    };
    static latencySum = 0;
    static latencyCount = 0;
    static recordDecision(decision) {
        const key = `decision=${decision}`;
        this.metrics.text_safety_decision_total.set(key, (this.metrics.text_safety_decision_total.get(key) || 0) + 1);
    }
    static recordLatency(ms) {
        this.latencySum += ms;
        this.latencyCount++;
    }
    static recordSignedUrlRefresh() {
        this.metrics.signed_url_refresh_total++;
    }
    static recordSignedUrlDeny() {
        this.metrics.signed_url_access_denied_total++;
    }
    static getPrometheusOutput() {
        const lines = [];
        lines.push('# HELP text_safety_decision_total Total text safety decisions by result');
        lines.push('# TYPE text_safety_decision_total counter');
        const decisions = ['PASS', 'WARN', 'BLOCK'];
        for (const d of decisions) {
            const val = this.metrics.text_safety_decision_total.get(`decision=${d}`) || 0;
            lines.push(`text_safety_decision_total{decision="${d}"} ${val}`);
        }
        lines.push('# HELP text_safety_latency_ms_sum Total latency in ms for text safety checks');
        lines.push('# TYPE text_safety_latency_ms_sum counter');
        lines.push(`text_safety_latency_ms_sum ${this.latencySum}`);
        lines.push('# HELP text_safety_latency_ms_count Total number of text safety checks');
        lines.push('# TYPE text_safety_latency_ms_count counter');
        lines.push(`text_safety_latency_ms_count ${this.latencyCount}`);
        lines.push('# HELP signed_url_refresh_total Total signed URL refresh operations');
        lines.push('# TYPE signed_url_refresh_total counter');
        lines.push(`signed_url_refresh_total ${this.metrics.signed_url_refresh_total}`);
        lines.push('# HELP signed_url_access_denied_total Total failed access attempts to signed/storage resources');
        lines.push('# TYPE signed_url_access_denied_total counter');
        lines.push(`signed_url_access_denied_total ${this.metrics.signed_url_access_denied_total}`);
        return lines.join('\n');
    }
}
exports.TextSafetyMetrics = TextSafetyMetrics;
//# sourceMappingURL=text_safety.metrics.js.map