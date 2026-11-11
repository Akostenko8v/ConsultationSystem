
import {
    ArrayUnique,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsString,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class UpdateTeacherDto {
    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(150)
    fullName?: string;

    @ValidateIf((_, value) => value !== undefined)
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(1, { each: true })
    disciplineIds?: number[];
}
