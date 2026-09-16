import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  PaymentStatus,
} from '../../../../generated/prisma/client';

export class UpdatePaymentDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

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
