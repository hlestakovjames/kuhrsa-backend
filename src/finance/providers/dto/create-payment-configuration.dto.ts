import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentConfigurationDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tillNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paybillNumber?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  callbackUrl?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
