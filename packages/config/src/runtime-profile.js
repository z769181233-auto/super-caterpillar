"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRuntimeConfig = getRuntimeConfig;
function getRuntimeConfig() {
    const isSafeMode = process.env.SAFE_MODE === '1';
    const defaultMaxInFlight = parseInt(process.env.JOB_MAX_IN_FLIGHT || '10', 10);
    return {
        jobMaxInFlight: isSafeMode ? 2 : defaultMaxInFlight,
        nodeMaxOldSpaceMb: isSafeMode ? 4096 : 8192,
    };
}
//# sourceMappingURL=runtime-profile.js.map