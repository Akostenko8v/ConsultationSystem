
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
} from 'class-validator';

export class RegisterDto {
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
}
