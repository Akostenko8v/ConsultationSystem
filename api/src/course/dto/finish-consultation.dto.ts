import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FinishConsultationDto {
  @IsIn(['COMPLETED', 'NO_SHOW'])
  status!: 'COMPLETED' | 'NO_SHOW';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherComment?: string;
}
