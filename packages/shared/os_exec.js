"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execAsync = execAsync;
const child_process_1 = require("child_process");
async function execAsync(cmd, args, opts = {}) {
    return await new Promise((resolve) => {
        const { timeoutMs, ...spawnOpts } = opts;
        const p = (0, child_process_1.spawn)(cmd, args, { ...spawnOpts });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const timer = timeoutMs
            ? setTimeout(() => {
                timedOut = true;
                p.kill('SIGKILL');
            }, timeoutMs)
            : null;
        p.stdout?.on('data', (d) => (stdout += d.toString()));
        p.stderr?.on('data', (d) => (stderr += d.toString()));
        p.on('error', (err) => {
            if (timer)
                clearTimeout(timer);
            stderr += `SPAWN_ERROR: ${err.message}`;
        });
        p.on('close', (code) => {
            if (timer)
                clearTimeout(timer);
            resolve({
                code: timedOut ? 124 : (code ?? 1),
                stdout,
                stderr,
                timedOut,
            });
        });
    });
}
//# sourceMappingURL=os_exec.js.map