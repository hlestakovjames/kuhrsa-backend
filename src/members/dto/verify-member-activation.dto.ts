import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class VerifyMemberActivationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  token!: string;

  @IsString()
  @IsNotEmpty()
  memberNumber!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
