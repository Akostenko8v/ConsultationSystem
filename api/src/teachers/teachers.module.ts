
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { TeachersController } from './teachers.controller.js';
import { TeachersService } from './teachers.service.js';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [TeachersController],
    providers: [TeachersService],
})
export class TeachersModule { }
