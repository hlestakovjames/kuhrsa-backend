import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  memberNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
