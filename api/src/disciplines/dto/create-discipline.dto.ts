
import {
    IsString,
    IsNotEmpty,
    MaxLength,
} from 'class-validator';

export class CreateDisciplineDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    code!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name!: string;
}
