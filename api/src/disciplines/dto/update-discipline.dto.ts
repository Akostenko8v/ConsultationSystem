
import {
    IsNotEmpty,
    IsString,
    MaxLength,
    ValidateIf,
} from 'class-validator';

export class UpdateDisciplineDto {
    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    code?: string;

    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name?: string;
}
