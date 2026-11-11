
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { AuditoriumsController } from './auditoriums.controller.js';
import { AuditoriumsService } from './auditoriums.service.js';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [AuditoriumsController],
    providers: [AuditoriumsService],
})
export class AuditoriumsModule { }
