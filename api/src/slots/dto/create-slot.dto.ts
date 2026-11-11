
import {
    IsInt,
    IsISO8601,
    Min,
} from 'class-validator';

export class CreateSlotDto {
    @IsInt()
    @Min(1)
    disciplineId!: number;

    @IsInt()
    @Min(1)
    auditoriumId!: number;

    @IsISO8601({ strict: true })
    startsAt!: string;

    @IsISO8601({ strict: true })
    endsAt!: string;
}
