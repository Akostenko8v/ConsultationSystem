import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  Min,
  ValidateNested,
} from 'class-validator';

export class SlotPeriodDto {
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsISO8601({ strict: true })
  endsAt!: string;
}

export class WeeklySlotsDto {
  @IsInt()
  @Min(1)
  disciplineId!: number;

  @IsInt()
  @Min(1)
  auditoriumId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => SlotPeriodDto)
  slots!: SlotPeriodDto[];
}
