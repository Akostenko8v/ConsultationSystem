import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CourseService } from './course.service.js';
import { FinishConsultationDto } from './dto/finish-consultation.dto.js';
import { WeeklySlotsDto } from './dto/weekly-slots.dto.js';

type AuthenticatedRequest = {
  user: { id: number; role: 'STUDENT' | 'TEACHER' | 'ADMIN' };
};

@Controller('course')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Get('teacher/bookings')
  @Roles('TEACHER')
  teacherBookings(@Req() req: AuthenticatedRequest) {
    return this.service.teacherBookings(req.user.id);
  }

  @Patch('teacher/bookings/:id/finish')
  @Roles('TEACHER')
  finish(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinishConsultationDto,
  ) {
    return this.service.finish(req.user.id, id, dto);
  }

  @Post('teacher/slots/weekly')
  @Roles('TEACHER')
  weekly(@Req() req: AuthenticatedRequest, @Body() dto: WeeklySlotsDto) {
    return this.service.weekly(req.user.id, dto);
  }

  @Get('admin/report')
  @Roles('ADMIN')
  report(@Query('from') from: string, @Query('to') to: string) {
    return this.service.report(from, to);
  }

  @Get('student/disciplines')
  @Roles('STUDENT')
  studentDisciplines(@Req() req: AuthenticatedRequest) {
    return this.service.studentDisciplines(req.user.id);
  }
  @Post('student/disciplines/:id')
  @Roles('STUDENT')
  enrollDiscipline(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.enrollDiscipline(req.user.id, id);
  }
  @Delete('student/disciplines/:id')
  @Roles('STUDENT')
  removeDiscipline(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.removeDiscipline(req.user.id, id);
  }

  @Get('admin/stats')
  @Roles('ADMIN')
  stats() {
    return this.service.stats();
  }
}
