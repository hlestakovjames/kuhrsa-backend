import {
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTermDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}
