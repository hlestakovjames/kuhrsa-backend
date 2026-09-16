import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class WaiveMemberChargeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
