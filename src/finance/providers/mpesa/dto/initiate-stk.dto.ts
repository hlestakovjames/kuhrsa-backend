import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class InitiateStkDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:254|\+254|0)7\d{8}$/, {
    message: 'phoneNumber must be a valid Kenyan mobile number.',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountReference!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  transactionDescription!: string;
}
