import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class InitiateMemberStkDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:254|\\+254|0)7\\d{8}$/, {
    message: 'phoneNumber must be a valid Kenyan mobile number.',
  })
  phoneNumber!: string;
}