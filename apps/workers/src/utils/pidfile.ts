import fs from "node:fs";
import path from "node:path";

function safeUnlink(p: string) {
    try { fs.unlinkSync(p); } catch { }
}

export function writeWorkerPidFile(workerId: string) {
    const dir = process.env.WORKER_PID_DIR || path.join(process.cwd(), ".runtime", "pids");
    const file = process.env.WORKER_PID_FILE || path.join(dir, `${workerId}.pid`);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, `${process.pid}\n`, "utf8");

    // best-effort cleanup
    const cleanup = () => safeUnlink(file);
    process.on("exit", cleanup);
    process.on("SIGINT", () => { cleanup(); process.exit(130); });
    process.on("SIGTERM", () => { cleanup(); process.exit(143); });

    return { dir, file };
}
