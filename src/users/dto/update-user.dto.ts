import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';
}
