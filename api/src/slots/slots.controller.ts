
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { SlotsService } from './slots.service.js';
import { CreateSlotDto } from './dto/create-slot.dto.js';
import { UpdateSlotDto } from './dto/update-slot.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

type AuthenticatedRequest = {
    user: {
        id: number;
        role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    };
};

@Controller('slots')
export class SlotsController {
    constructor(
        private readonly slotsService: SlotsService,
    ) { }

    @Get()
    findAll() {
        return this.slotsService.findAll();
    }

    @Get('mine')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('TEACHER')
    findMine(@Req() request: AuthenticatedRequest) {
        return this.slotsService.findMine(request.user.id);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.slotsService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('TEACHER')
    create(
        @Req() request: AuthenticatedRequest,
        @Body() dto: CreateSlotDto,
    ) {
        return this.slotsService.create(request.user.id, dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('TEACHER')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: AuthenticatedRequest,
        @Body() dto: UpdateSlotDto,
    ) {
        return this.slotsService.update(
            id,
            request.user.id,
            dto,
        );
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('TEACHER')
    remove(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.slotsService.remove(id, request.user.id);
    }
}
