import { IsOptional, IsString, IsUUID } from 'class-validator';

export class InstantiateCE01Dto {
  @IsString()
  @IsUUID()
  characterId: string;

  @IsString()
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsString()
  posePreset?: string;

  @IsOptional()
  @IsString()
  styleSeed?: string;

  @IsOptional()
  @IsString()
  traceId?: string;
}
