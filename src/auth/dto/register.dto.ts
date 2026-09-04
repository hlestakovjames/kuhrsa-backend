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

import { MemberCategory } from '../../../generated/prisma/client';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEnum(MemberCategory)
  category!: MemberCategory;

  /*
   * Student:
   * Required university registration/admission identifier.
   *
   * Alumni:
   * Optional because some alumni may not remember it.
   *
   * Lecturer:
   * Not required; lecturers use staffNumber.
   */
  @ValidateIf(
    (dto: RegisterDto) =>
      dto.category === MemberCategory.STUDENT ||
      (dto.category === MemberCategory.ALUMNI && !!dto.registrationNumber),
  )
  @IsString()
  @IsNotEmpty()
  registrationNumber?: string;

  /*
   * Student only: Year 1–4.
   */
  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.STUDENT)
  @IsInt()
  @Min(1)
  @Max(4)
  yearOfStudy?: number;

  /*
   * Alumni only: graduation year.
   */
  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.ALUMNI)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  graduationYear?: number;

  /*
   * Alumni only: National ID.
   */
  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.ALUMNI)
  @IsString()
  @IsNotEmpty()
  nationalId?: string;

  /*
   * Lecturer only: Staff/Employee Number.
   */
  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.LECTURER)
  @IsString()
  @IsNotEmpty()
  staffNumber?: string;

  /*
   * Student / Alumni academic information.
   */
  @ValidateIf(
    (dto: RegisterDto) =>
      dto.category === MemberCategory.STUDENT ||
      dto.category === MemberCategory.ALUMNI,
  )
  @IsString()
  @IsNotEmpty()
  programme?: string;

  @ValidateIf(
    (dto: RegisterDto) =>
      dto.category === MemberCategory.STUDENT ||
      dto.category === MemberCategory.ALUMNI ||
      dto.category === MemberCategory.LECTURER,
  )
  @IsString()
  @IsNotEmpty()
  faculty!: string;

  @ValidateIf(
    (dto: RegisterDto) =>
      dto.category === MemberCategory.STUDENT ||
      dto.category === MemberCategory.ALUMNI ||
      dto.category === MemberCategory.LECTURER,
  )
  @IsString()
  @IsNotEmpty()
  department!: string;

  /*
   * Lecturer only.
   */
  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.LECTURER)
  @IsString()
  @IsNotEmpty()
  position?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  county?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
