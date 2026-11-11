
import {
    ArrayUnique,
    IsArray,
    IsEmail,
    IsInt,
    IsNotEmpty,
    IsString,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class CreateTeacherDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(150)
    fullName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(72)
    password!: string;

    @ValidateIf((_, value) => value !== undefined)
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(1, { each: true })
    disciplineIds?: number[];
}
