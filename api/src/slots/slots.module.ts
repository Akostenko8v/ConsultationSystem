
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [SlotsController],
    providers: [SlotsService],
})
export class SlotsModule { }
