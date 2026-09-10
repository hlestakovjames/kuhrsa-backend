import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';

export class CreatePositionAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  memberId!: string;

  @IsUUID()
  @IsNotEmpty()
  positionId!: string;

  @IsUUID()
  @IsNotEmpty()
  termId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
