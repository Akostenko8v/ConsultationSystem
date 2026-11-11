
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';

import { AuditoriumsService } from './auditoriums.service.js';
import { CreateAuditoriumDto } from './dto/create-auditorium.dto.js';
import { UpdateAuditoriumDto } from './dto/update-auditorium.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('auditoriums')
export class AuditoriumsController {
    constructor(
        private readonly auditoriumsService: AuditoriumsService,
    ) { }

    @Get()
    findAll() {
        return this.auditoriumsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.auditoriumsService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() dto: CreateAuditoriumDto) {
        return this.auditoriumsService.create(dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAuditoriumDto,
    ) {
        return this.auditoriumsService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.auditoriumsService.remove(id);
    }
}
