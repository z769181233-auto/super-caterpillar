export type CameraMotionMode = 'static' | 'pan' | 'tilt' | 'zoom' | 'dolly' | 'orbit';

export interface CameraKeyframe {
  frame: number;
  x: number;
  y: number;
  z: number;
  r?: number; // Rotation
}

export interface VG04Input {
  shot_description: string;
  pacing_score?: number;
  emotional_intensity?: number;
  duration?: number;
  fps?: number;
  context?: {
    projectId: string;
    [key: string]: any;
  };
}

export interface VG04Output {
  mode: CameraMotionMode;
  keyframes: CameraKeyframe[];
  duration: number;
  fps: number;
  description: string;
  audit_trail: {
    engine_version: string;
    timestamp: string;
  };
  billing_usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
  };
}
