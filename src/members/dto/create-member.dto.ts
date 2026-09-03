import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { MemberCategory, MemberSource } from '../../../generated/prisma/client';

export class CreateMemberDto {
  @IsEnum(MemberCategory)
  category!: MemberCategory;

  @IsOptional()
  @IsString()
  @MinLength(2)
  registrationNumber?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsEnum(MemberSource)
  source?: MemberSource;
}
