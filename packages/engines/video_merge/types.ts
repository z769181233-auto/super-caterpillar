export interface VideoMergeInput {
  jobId: string;
  traceId?: string;
  /** Path pattern (e.g. "frames/%d.png") or list of files */
  framePattern?: string;
  framePaths?: string[];
  /** Video fragments to concat */
  videoPaths?: string[];
  fps?: number; // default 24
  width?: number; // default 512
  height?: number; // default 512
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
