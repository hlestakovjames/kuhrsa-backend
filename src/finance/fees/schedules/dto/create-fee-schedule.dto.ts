import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ConstitutionalMembershipCategory,
  MemberCategory,
} from '../../../../../generated/prisma/client';

export class CreateFeeScheduleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsEnum([
    'DRAFT',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
  ])
  status!: string;

  @IsDateString()
  effectiveFrom!: string;

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
