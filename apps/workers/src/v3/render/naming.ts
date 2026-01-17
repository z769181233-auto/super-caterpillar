import * as crypto from 'crypto';

/**
 * P2-FIX-2: 单一真源命名函数
 * 
 * 产物命名必须包含 shotId/traceId，且符合 C1 规范（相对路径）
 */

export interface RenderArtifactNameParams {
    shotId: string;
    traceId?: string | null;
    seed: number;
    ext: 'png' | 'webp' | 'mp4';
}

/**
 * 构建标准化的渲染产物文件名
 * 
 * 格式: shot_{shotId}_trace_{last8}_seed.{ext}
 * 示例: shot_shot123_trace_abc12345_42.png
 */
export function buildRenderArtifactName(params: RenderArtifactNameParams): string {
    const safeShot = (params.shotId || 'no_shot').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeTrace = (params.traceId || 'no_trace').slice(-8).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeSeed = Number.isFinite(params.seed) ? params.seed : 0;

    return `shot_${safeShot}_trace_${safeTrace}_${safeSeed}.${params.ext}`;
}

/**
 * C1 路径校验：确保路径符合相对路径规范，拒绝绝对路径和危险模式
 */
export function validateC1Path(path: string): { valid: boolean; reason?: string } {
    // Reject absolute paths (Unix)
    if (path.startsWith('/')) {
        return { valid: false, reason: 'Absolute Unix path not allowed' };
    }

    // Reject absolute paths (Windows)
    if (/^[A-Za-z]:[\\/]/.test(path)) {
        return { valid: false, reason: 'Absolute Windows path not allowed' };
    }

    // Reject parent directory traversal
    if (path.includes('../') || path.includes('..\\')) {
        return { valid: false, reason: 'Parent directory traversal not allowed' };
    }

    // Reject URL schemes
    if (path.includes('://')) {
        return { valid: false, reason: 'URL schemes not allowed' };
    }

    // Allowlist: must start with approved prefixes
    const allowedPrefixes = ['assets/', '_dynamic/', '.runtime/assets/', 'apps/workers/.runtime/assets/'];
    const hasAllowedPrefix = allowedPrefixes.some(prefix => path.startsWith(prefix));

    if (!hasAllowedPrefix) {
        return {
            valid: false,
            reason: `Path must start with one of: ${allowedPrefixes.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * 计算文件的 SHA256 hash
 */
export function sha256File(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}
