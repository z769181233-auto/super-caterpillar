export interface VideoMergeInput {
  jobId: string;
  traceId?: string;
  /** Path pattern (e.g. "frames/%d.png") or list of files */
  framePattern?: string;
  framePaths?: string[];
  /** Video fragments to concat */
  videoPaths?: string[];
  /** Required when framePaths/framePattern are used */
  fps?: number;
  /** Required when framePaths/framePattern are used */
  width?: number;
  /** Required when framePaths/framePattern are used */
  height?: number;
  context?: any;
}

export interface VideoMergeOutput {
  asset: {
    uri: string;
    mimeType: 'video/mp4';
    sizeBytes: number;
    sha256: string;
    width: number;
    height: number;
    durationSeconds: number;
  };
  render_meta: {
    model: string;
    fps: number;
    codec: string;
  };
  audit_trail: {
    engineKey: string;
    engineVersion: string;
    timestamp: string;
    paramsHash: string;
    traceId?: string;
  };
  billing_usage: {
    cpuSeconds: number;
    gpuSeconds: number; // 0
    model: string;
  };
}
