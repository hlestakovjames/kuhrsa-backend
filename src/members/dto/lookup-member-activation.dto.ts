import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LookupMemberActivationDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;
}
