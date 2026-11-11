
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SlotsModule } from './slots/slots.module.js';
import { AuditoriumsModule } from './auditoriums/auditoriums.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DatabaseController } from './database/database.controller.js';
import { TeachersModule } from './teachers/teachers.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CourseModule } from './course/course.module.js';
import { DisciplinesModule } from './disciplines/disciplines.module.js';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        DisciplinesModule,
        AuditoriumsModule,
        TeachersModule,
        SlotsModule,
        BookingsModule,
        CourseModule,
    ],
    controllers: [
        AppController,
        DatabaseController,
    ],
    providers: [AppService],
})
export class AppModule { }
