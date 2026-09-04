import { IsEmail, IsNotEmpty } from 'class-validator';

export class LinkMemberAccountDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
