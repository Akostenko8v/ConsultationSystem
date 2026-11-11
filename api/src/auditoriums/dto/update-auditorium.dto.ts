
import {
    IsNotEmpty,
    IsString,
    MaxLength,
    ValidateIf,
} from 'class-validator';

export class UpdateAuditoriumDto {
    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    building?: string;

    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    number?: string;
}
