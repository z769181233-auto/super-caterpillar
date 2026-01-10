import { spawn } from 'child_process';

/**
 * spawnWithTimeout
 * 包装 child_process.spawn，支持超时自动 SIGKILL
 */
export async function spawnWithTimeout(opts: {
  cmd: string;
  args: string[];
  timeoutMs: number;
  killSignal?: NodeJS.Signals;
}): Promise<{ code: number | null; stderr: string; timedOut: boolean }> {
  const { cmd, args, timeoutMs, killSignal = 'SIGKILL' } = opts;

  return await new Promise((resolve, reject) => {
    // 强制使用 pipe 以获取 stderr，同时忽略 stdin/stdout 以节省资源
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.stdout.write(`[Guardrail] WARN: Killing process ${child.pid} due to timeout (${timeoutMs}ms)\n`);
        child.kill(killSignal);
      } catch (e: any) {
        process.stdout.write(`[Guardrail] ERROR: Failed to kill process ${child.pid}: ${e.message}\n`);
      }
    }, timeoutMs);

    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, timedOut });
    });
  });
}
