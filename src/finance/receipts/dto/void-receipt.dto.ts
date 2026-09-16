import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class VoidReceiptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
