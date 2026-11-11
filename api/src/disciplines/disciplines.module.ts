
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { DisciplinesController } from './disciplines.controller.js';
import { DisciplinesService } from './disciplines.service.js';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [DisciplinesController],
    providers: [DisciplinesService],
})
export class DisciplinesModule { }
