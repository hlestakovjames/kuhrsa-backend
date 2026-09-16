import {
  IsNumber,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentAllocationDto {
  @IsString()
  @IsNotEmpty()
  chargeId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}
