import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
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
   * ------------------------------------------------------------
   * REGISTRATION / ADMISSION NUMBER
   * ------------------------------------------------------------
   *
   * Student:
   * Required university registration/admission identifier.
   *
   * Alumni:
   * Optional because some alumni may not remember it.
   *
   * Lecturer:
   * Not used; lecturers use staffNumber.
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
   * ------------------------------------------------------------
   * STUDENT
   * ------------------------------------------------------------
   *
   * Student year of study: Year 1–4.
   */

  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.STUDENT)
  @IsInt()
  @Min(1)
  @Max(4)
  yearOfStudy?: number;

  /*
   * ------------------------------------------------------------
   * ALUMNI
   * ------------------------------------------------------------
   *
   * Graduation year.
   */

  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.ALUMNI)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  graduationYear?: number;

  /*
   * Alumni National ID.
   */

  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.ALUMNI)
  @IsString()
  @IsNotEmpty()
  nationalId?: string;

  /*
   * ------------------------------------------------------------
   * LECTURER
   * ------------------------------------------------------------
   *
   * Staff/Employee Number.
   */

  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.LECTURER)
  @IsString()
  @IsNotEmpty()
  staffNumber?: string;

  /*
   * ------------------------------------------------------------
   * ACADEMIC INFORMATION
   * ------------------------------------------------------------
   *
   * Student / Alumni.
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
   * Lecturer position/title.
   */

  @ValidateIf((dto: RegisterDto) => dto.category === MemberCategory.LECTURER)
  @IsString()
  @IsNotEmpty()
  position?: string;

  /*
   * ------------------------------------------------------------
   * CONTACT INFORMATION
   * ------------------------------------------------------------
   */

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

  /*
   * ------------------------------------------------------------
   * PASSWORD
   * ------------------------------------------------------------
   *
   * Password is intentionally NOT collected during registration.
   *
   * Registration:
   *   Member record + inactive user account
   *
   * Activation:
   *   Member verification + password creation + account activation
   *
   * The activation DTO is responsible for collecting the password.
   */
}
