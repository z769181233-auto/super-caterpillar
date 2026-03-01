import { IsArray, IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

/**
 * Video Render Job Input Payload
 * Strict typing for Stage 8 Architecture
 */
export class VideoRenderInput {
  /**
   * Target Shot ID
   */
  @IsString()
  @IsNotEmpty()
  shotId!: string;

  /**
   * List of frame storage keys (e.g. "shots/uuid/frames/1.png")
   */
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  frameKeys!: string[];

  /**
   * Frames per second
   */
  @IsNumber()
  fps!: number;
}

/**
 * Video Render Job Result Payload
 */
export class VideoRenderResult {
  /**
   * Output video storage key (e.g. "shots/uuid/render.mp4")
   */
  @IsString()
  @IsNotEmpty()
  videoKey!: string;

  @IsOptional()
  @IsNumber()
  durationMs?: number;

  @IsNumber()
  sizeBytes!: number;
}
