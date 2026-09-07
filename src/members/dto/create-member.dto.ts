import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { MemberCategory, MemberSource } from '../../../generated/prisma/client';

export class CreateMemberDto {
  @IsEnum(MemberCategory)
  category!: MemberCategory;

  /*
   * ------------------------------------------------------------
   * STUDENT / ALUMNI IDENTIFICATION
   * ------------------------------------------------------------
   *
   * Student:
   * Required.
   *
   * Alumni:
   * Optional because some alumni may not remember it.
   */

  @ValidateIf(
    (dto: CreateMemberDto) =>
      dto.category === MemberCategory.STUDENT ||
      (dto.category === MemberCategory.ALUMNI && !!dto.registrationNumber),
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  registrationNumber?: string;

  /*
   * ------------------------------------------------------------
   * ALUMNI IDENTIFICATION
   * ------------------------------------------------------------
   */

  @ValidateIf((dto: CreateMemberDto) => dto.category === MemberCategory.ALUMNI)
  @IsString()
  @IsNotEmpty()
  nationalId?: string;

  @ValidateIf((dto: CreateMemberDto) => dto.category === MemberCategory.ALUMNI)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  graduationYear?: number;

  /*
   * ------------------------------------------------------------
   * STUDENT ACADEMIC INFORMATION
   * ------------------------------------------------------------
   */

  @ValidateIf((dto: CreateMemberDto) => dto.category === MemberCategory.STUDENT)
  @IsInt()
  @Min(1)
  @Max(4)
  yearOfStudy?: number;

  /*
   * ------------------------------------------------------------
   * STUDENT / ALUMNI ACADEMIC INFORMATION
   * ------------------------------------------------------------
   */

  @ValidateIf(
    (dto: CreateMemberDto) =>
      dto.category === MemberCategory.STUDENT ||
      dto.category === MemberCategory.ALUMNI,
  )
  @IsString()
  @IsNotEmpty()
  programme?: string;

  /*
   * ------------------------------------------------------------
   * LECTURER IDENTIFICATION
   * ------------------------------------------------------------
   */

  @ValidateIf(
    (dto: CreateMemberDto) => dto.category === MemberCategory.LECTURER,
  )
  @IsString()
  @IsNotEmpty()
  staffNumber?: string;

  @ValidateIf(
    (dto: CreateMemberDto) => dto.category === MemberCategory.LECTURER,
  )
  @IsString()
  @IsNotEmpty()
  position?: string;

  /*
   * ------------------------------------------------------------
   * SHARED ACADEMIC / PROFESSIONAL INFORMATION
   * ------------------------------------------------------------
   */

  @IsString()
  @IsNotEmpty()
  faculty!: string;

  @IsString()
  @IsNotEmpty()
  department!: string;

  /*
   * ------------------------------------------------------------
   * PERSONAL INFORMATION
   * ------------------------------------------------------------
   */

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  lastName!: string;

  /*
   * ------------------------------------------------------------
   * CONTACT INFORMATION
   * ------------------------------------------------------------
   *
   * Legacy records may not have email or phone.
   */

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  county?: string;

  /*
   * ------------------------------------------------------------
   * SOURCE
   * ------------------------------------------------------------
   *
   * Normal administrative creation uses MANUAL_ENTRY.
   *
   * Migration uses:
   * - MIGRATION_IMPORT
   * - MIGRATION_MANUAL
   *
   * The normal administrative member creation endpoint
   * explicitly overrides the source with MANUAL_ENTRY.
   *
   * This field remains available because migration-related
   * workflows may use the same DTO with a source override.
   */

  @IsOptional()
  @IsEnum(MemberSource)
  source?: MemberSource;
}
