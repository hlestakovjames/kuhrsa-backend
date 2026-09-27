import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMemberDto {
  /*
   * ------------------------------------------------------------
   * MEMBER IDENTIFICATION
   * ------------------------------------------------------------
   */

  @IsOptional()
  @IsString()
  @MinLength(2)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  staffNumber?: string;

  /*
   * ------------------------------------------------------------
   * ACADEMIC / PROFESSIONAL INFORMATION
   * ------------------------------------------------------------
   */

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  yearOfStudy?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  graduationYear?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  programme?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  faculty?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  /*
   * ------------------------------------------------------------
   * MEMBER CONTACT INFORMATION
   * ------------------------------------------------------------
   *
   * This updates the Member record only.
   *
   * It does NOT link or modify a User account.
   * Account linking remains a separate operation.
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
}
