
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAuditoriumDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    building!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    number!: string;
}
