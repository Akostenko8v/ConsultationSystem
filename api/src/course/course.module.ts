import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CourseController } from './course.controller.js';
import { CourseService } from './course.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [CourseController],
  providers: [CourseService],
})
export class CourseModule {}
