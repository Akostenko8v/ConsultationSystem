
import { IsBoolean } from 'class-validator';

export class UpdateSlotDto {
    @IsBoolean()
    isBlocked!: boolean;
}
