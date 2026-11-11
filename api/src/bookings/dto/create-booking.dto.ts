
import {
    IsInt,
    IsNotEmpty,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';

export class CreateBookingDto {
    @IsInt()
    @Min(1)
    slotId!: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    topic!: string;

    @IsUUID('4')
    idempotencyKey!: string;
}
