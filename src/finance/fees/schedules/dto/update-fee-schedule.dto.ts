import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ConstitutionalMembershipCategory,
  MemberCategory,
  FeeScheduleStatus,
} from '../../../../../generated/prisma/client';

export class UpdateFeeScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsEnum(FeeScheduleStatus)
  status?: FeeScheduleStatus;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsEnum(ConstitutionalMembershipCategory)
  constitutionalCategory?: ConstitutionalMembershipCategory;

  @IsOptional()
  @IsEnum(MemberCategory)
  memberCategory?: MemberCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
