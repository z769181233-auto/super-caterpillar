import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserType } from 'database';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(UserType)
  @IsOptional()
  userType?: UserType;
}
