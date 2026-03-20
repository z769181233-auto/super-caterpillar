import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

/**
 * 手动触发 Film IR 规划的 DTO
 * P1 阶段：只接受 sceneId，Planner 逻辑在 P2 实现
 */
export class CreateFilmIRDto {
  @IsString()
  sceneId: string;

  @IsOptional()
  @IsString()
  plannerVersion?: string;

  @IsOptional()
  @IsString()
  sourceText?: string;

  @IsOptional()
  @IsString()
  sourceContextSummary?: string;
}

/**
 * 手动更新 Film IR 导演决策字段（P2 阶段扩充）
 */
export class UpdateFilmIRDto {
  @IsOptional()
  @IsString()
  dramaticFunction?: string;

  @IsOptional()
  @IsString()
  dramaticGoal?: string;

  @IsOptional()
  @IsString()
  emotionalTarget?: string;

  @IsOptional()
  @IsString()
  @IsIn(['RISING', 'FALLING', 'PLATEAU', 'SPIKE', 'VALLEY'])
  tensionCurve?: string;

  @IsOptional()
  @IsString()
  visualStrategy?: string;

  @IsOptional()
  @IsString()
  shotPattern?: string;

  @IsOptional()
  @IsNumber()
  avgShotLengthSec?: number;

  @IsOptional()
  @IsString()
  whyThisChoice?: string;

  @IsOptional()
  @IsNumber()
  qualityScore?: number;

  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'APPROVED', 'LOCKED'])
  status?: string;
}
