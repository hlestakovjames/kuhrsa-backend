import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { MemberCategory } from '../../../generated/prisma/client';

export class CreateMemberDto {
  @IsEnum(MemberCategory)
  category!: MemberCategory;

  @IsOptional()
  @IsString()
  @MinLength(2)
  registrationNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
