import { spawn } from 'child_process';

/**
 * Executes a command asynchronously and returns the result.
 * Prevents blocking the event loop (avoid spawnSync).
 * Supports timeoutMs for resource guardrails.
 */
export async function execAsync(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; [key: string]: any } = {}
): Promise<{ code: number; stdout: string; stderr: string; timedOut?: boolean }> {
  return await new Promise((resolve) => {
    const { timeoutMs, ...spawnOpts } = opts;
    const p = spawn(cmd, args, { ...spawnOpts });

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
      if (timer) clearTimeout(timer);
      stderr += `SPAWN_ERROR: ${err.message}`;
    });

    p.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        code: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}
