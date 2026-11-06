import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
