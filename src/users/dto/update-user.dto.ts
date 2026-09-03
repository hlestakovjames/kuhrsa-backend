import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';
}
